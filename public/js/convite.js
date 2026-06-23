import { db } from "./firebase-config.js";
import { 
    doc, 
    getDoc, 
    updateDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { showModal } from "./modal.js";

// 1. Extrair ID do convite a partir da URL (suporta caminhos dinâmicos reescritos)
const pathParts = window.location.pathname.split('/').filter(Boolean);
const inviteId = pathParts[pathParts.length - 1];

// Elementos da página
const loadingContainer = document.getElementById("loadingContainer");
const inviteContainer = document.getElementById("inviteContainer");
const errorContainer = document.getElementById("errorContainer");

let inviteData = null;
let tempDateData = { data: "", hora: "" };
let recusaIndex = 0;

// Inicialização
async function loadInvite() {
    if (!inviteId || inviteId === "convite") {
        showError();
        return;
    }

    try {
        const docRef = doc(db, "convites", inviteId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            showError();
            return;
        }

        inviteData = docSnap.data();
        applyPersonalization();
        setupEventListeners();
        showInvite();
    } catch (err) {
        console.error("Erro ao carregar convite:", err);
        showError();
    }
}

function showInvite() {
    loadingContainer.style.display = "none";
    inviteContainer.style.display = "flex";
}

function showError() {
    loadingContainer.style.display = "none";
    errorContainer.style.display = "flex";
}

// Aplicar personalizações definidas pelo remetente
function applyPersonalization() {
    const p = inviteData.personalizacao || {};
    
    // Cor de Fundo
    if (p.corFundo) {
        document.body.style.backgroundImage = "none";
        document.body.style.backgroundColor = p.corFundo;
    }

    // Cor do Card Central
    if (p.corCard) {
        inviteContainer.style.background = p.corCard;
    }

    // Nome personalizado do destinatário
    const mainQuestion = document.getElementById("mainQuestion");
    if (inviteData.nomeDestinatario) {
        mainQuestion.textContent = `Oi ${inviteData.nomeDestinatario}! Alguém quer te convidar para um date 🌸`;
    }

    // Mensagem personalizada
    if (p.mensagemPersonalizada) {
        const msgPara = document.getElementById("customMessage");
        msgPara.textContent = p.mensagemPersonalizada;
        msgPara.style.display = "block";
    }

    // Imagens Personalizadas
    if (p.imagens && Array.isArray(p.imagens)) {
        if (p.imagens[0]) document.getElementById("imgStep1").src = p.imagens[0];
        if (p.imagens[1]) document.getElementById("imgStep2").src = p.imagens[1];
        if (p.imagens[2]) document.getElementById("imgStep5").src = p.imagens[2];
    }
}

// Controle de Navegação de Passos
function nextStep(next) {
    document.querySelectorAll(".step").forEach(s => s.classList.remove("active"));
    document.getElementById("step" + next).classList.add("active");
}

function setupEventListeners() {
    const btnYes1 = document.getElementById("btnYes1");
    const btnOk = document.getElementById("btnOk");
    const btnSaveTime = document.getElementById("btnSaveTime");
    const btnNo = document.getElementById("btnNo");
    const wrapper = document.querySelector(".buttons-wrapper");

    // Avançar para tela de comemoração
    btnYes1.addEventListener("click", () => nextStep(2));
    
    // Avançar para escolha de data
    btnOk.addEventListener("click", () => nextStep(3));

    // Salvar data e hora temporariamente e avançar para alimentos
    btnSaveTime.addEventListener("click", async () => {
        const dateInput = document.getElementById("datePicker").value;
        const timeInput = document.getElementById("timePicker").value;

        if (!dateInput || !timeInput) {
            await showModal({ type: "alert", message: "Escolha o dia e o horário direitinho! 😉" });
            return;
        }

        tempDateData.data = dateInput.split("-").reverse().join("/");
        tempDateData.hora = timeInput;
        nextStep(4);
    });

    // Lógica do botão de recusa "Não" (Muda o texto e foge)
    const fugirBotao = function() {
        const maxX = wrapper.offsetWidth - btnNo.offsetWidth;
        const maxY = wrapper.offsetHeight + 40;
        
        btnNo.style.left = Math.floor(Math.random() * maxX) + 'px';
        btnNo.style.top = (Math.floor(Math.random() * maxY) - 20) + 'px';
        btnNo.style.right = 'auto';

        // Ciclar pelos textos personalizados de recusa
        const opcoesRecusa = inviteData.personalizacao.opcoesRecusa || ["não...", "tem certeza? 🤔"];
        if (opcoesRecusa.length > 0) {
            btnNo.textContent = opcoesRecusa[recusaIndex];
            recusaIndex = (recusaIndex + 1) % opcoesRecusa.length;
        }
    };

    btnNo.addEventListener("mouseover", fugirBotao);
    btnNo.addEventListener("touchstart", function(e) {
        e.preventDefault();
        fugirBotao();
    });

    // Itens de comida
    const foodItems = document.querySelectorAll(".food-item");
    foodItems.forEach(item => {
        item.addEventListener("click", async () => {
            const foodName = item.getAttribute("data-food");
            nextStep(5);
            
            try {
                // Atualizar o status e dados no Firestore
                const docRef = doc(db, "convites", inviteId);
                await updateDoc(docRef, {
                    status: "aceito",
                    horarioEscolhido: `${tempDateData.data} às ${tempDateData.hora}`,
                    alimentoEscolhido: foodName,
                    aceitoEm: serverTimestamp()
                });
            } catch (err) {
                console.error("Erro ao salvar resposta no Firestore:", err);
            }
        });
    });
}

// Iniciar carregamento do convite
loadInvite();
