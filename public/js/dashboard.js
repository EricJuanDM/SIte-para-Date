import { auth, db, storage } from "./firebase-config.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    query, 
    where, 
    onSnapshot, 
    getDocs,
    serverTimestamp,
    getDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";
import { showModal } from "./modal.js";

const placesArray = [];
const lugaresList = document.getElementById("lugaresList");
const btnAddLugar = document.getElementById("btnAddLugar");
const inviteForm = document.getElementById("inviteForm");
const recusaList = document.getElementById("recusaList");
const btnAddRecusa = document.getElementById("btnAddRecusa");

let recusaCount = 0;
let unsubscribeSent = null;
let unsubscribeReceived = null;
let userNome = "Remetente";

// 0. Alternância de Abas do Dashboard
window.switchDashboardTab = function(tabId) {
    document.querySelectorAll(".dashboard-tab-content").forEach(el => {
        el.classList.remove("active");
    });
    document.querySelectorAll(".tab-button").forEach(el => {
        el.classList.remove("active");
    });

    const activeTab = document.getElementById(`tab-${tabId}`);
    const activeBtn = document.getElementById(`tabBtn-${tabId}`);

    if (activeTab) activeTab.classList.add("active");
    if (activeBtn) activeBtn.classList.add("active");
};

// 1. Controle de Lugares Dinâmicos
function addLugarItem(emoji, nome) {
    if (placesArray.length >= 6) {
        showModal({ type: "alert", message: "O limite máximo é de 6 opções de lugares! ⛔" });
        return;
    }
    
    const item = { emoji: emoji.trim() || "📍", nome: nome.trim() };
    placesArray.push(item);
    renderPlaces();
}

function renderPlaces() {
    lugaresList.innerHTML = "";
    placesArray.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "lugar-item";
        div.innerHTML = `
            <span class="emoji">${item.emoji}</span>
            <span class="nome">${item.nome}</span>
            <button type="button" class="btn-remove-lugar" onclick="removeLugarItem(${index})">🗑️</button>
        `;
        lugaresList.appendChild(div);
    });
}

window.removeLugarItem = function(index) {
    if (placesArray.length <= 2) {
        showModal({ type: "alert", message: "Você precisa definir pelo menos 2 opções de lugares! ⛔" });
        return;
    }
    placesArray.splice(index, 1);
    renderPlaces();
};

// Iniciar com lugares padrão
addLugarItem("🍕", "Pizza");
addLugarItem("🍣", "Sushi");

if (btnAddLugar) {
    btnAddLugar.addEventListener("click", () => {
        const emojiInput = document.getElementById("lugarEmoji");
        const nomeInput = document.getElementById("lugarNome");
        const emoji = emojiInput.value.trim();
        const nome = nomeInput.value.trim();
        
        if (!nome) {
            showModal({ type: "alert", message: "Digite o nome do lugar! 📍" });
            return;
        }
        
        addLugarItem(emoji, nome);
        emojiInput.value = "";
        nomeInput.value = "";
    });
}

// 1.5. Controle de Opções de Recusa
async function addRecusaField(value = "") {
    const currentFields = recusaList ? recusaList.children.length : 0;
    if (currentFields >= 5) {
        await showModal({ type: "alert", message: "O limite máximo é de 5 opções de recusa! ⛔" });
        return;
    }
    
    recusaCount++;
    const div = document.createElement("div");
    div.className = "recusa-item";
    div.id = `recusa-item-${recusaCount}`;
    
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Opção ${currentFields + 1}`;
    input.value = value;
    input.required = true;
    input.maxLength = 50;
    
    const btnRemove = document.createElement("button");
    btnRemove.type = "button";
    btnRemove.className = "btn-remove-recusa";
    btnRemove.innerHTML = "🗑️";
    btnRemove.onclick = async () => {
        if (recusaList.children.length <= 2) {
            await showModal({ type: "alert", message: "Você precisa definir pelo menos 2 opções de recusa! ⛔" });
            return;
        }
        div.remove();
        updateRecusaPlaceholders();
    };
    
    div.appendChild(input);
    div.appendChild(btnRemove);
    recusaList.appendChild(div);
    updateRecusaPlaceholders();
}

function updateRecusaPlaceholders() {
    Array.from(recusaList.children).forEach((child, index) => {
        const input = child.querySelector("input");
        if (input) input.placeholder = `Opção ${index + 1}`;
    });
}

// Iniciar com opções de recusa padrão
addRecusaField("não...");
addRecusaField("tem certeza? 🤔");

if (btnAddRecusa) {
    btnAddRecusa.addEventListener("click", () => addRecusaField(""));
}

// 2. Limpeza silenciosa de convites expirados do remetente
async function cleanExpiredInvites(userId) {
    try {
        const q = query(
            collection(db, "convites"),
            where("remetenteId", "==", userId)
        );
        const snapshot = await getDocs(q);
        const now = new Date();
        snapshot.forEach(async (docSnap) => {
            const data = docSnap.data();
            if (data.expiraEm) {
                const expDate = data.expiraEm.toDate ? data.expiraEm.toDate() : new Date(data.expiraEm);
                if (expDate < now) {
                    await deleteDoc(doc(db, "convites", docSnap.id));
                }
            }
        });
    } catch (e) {
        console.error("Erro na limpeza de convites expirados:", e);
    }
}

// 3. Monitoramento em tempo real dos convites Enviados
function setupSentListener(userId) {
    const q = query(
        collection(db, "convites"), 
        where("remetenteId", "==", userId)
    );
    
    unsubscribeSent = onSnapshot(q, (snapshot) => {
        const listDiv = document.getElementById("invitationsList");
        if (snapshot.empty) {
            listDiv.innerHTML = `
                <p style="color: var(--color-text-light); text-align: center; margin-top: 40px; font-size: 13px;">
                    Você ainda não enviou nenhum convite. Crie um na primeira aba! 🌸
                </p>
            `;
            return;
        }
        
        // Ordenação manual em memória
        const docSnaps = [];
        snapshot.forEach(docSnap => docSnaps.push(docSnap));
        docSnaps.sort((a, b) => {
            const dateA = a.data().criadoEm ? (a.data().criadoEm.toMillis ? a.data().criadoEm.toMillis() : new Date(a.data().criadoEm).getTime()) : 0;
            const dateB = b.data().criadoEm ? (b.data().criadoEm.toMillis ? b.data().criadoEm.toMillis() : new Date(b.data().criadoEm).getTime()) : 0;
            return dateB - dateA;
        });

        listDiv.innerHTML = "";
        const now = new Date();

        docSnaps.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            const expiraEm = data.expiraEm ? (data.expiraEm.toDate ? data.expiraEm.toDate() : new Date(data.expiraEm)) : null;
            const isExpired = expiraEm && expiraEm < now;

            let statusText = "Pendente";
            let statusClass = "pendente";
            let detailsHtml = "";

            if (isExpired) {
                statusText = "Expirado";
                statusClass = "expirado";
                detailsHtml = `
                    <div class="invitation-details">
                        ⌛ <strong>Expirado</strong>
                    </div>
                `;
            } else if (data.status === "aceito" || data.horarioEscolhido) {
                statusText = "Aceito";
                statusClass = "aceito";
                detailsHtml = `
                    <div class="invitation-details">
                        ✅ <strong>${data.nomeDestinatario} aceitou!</strong><br>
                        📅 ${data.horarioEscolhido || "A definir"}<br>
                        📍 ${data.alimentoEscolhido || "A definir"}
                    </div>
                `;
            } else {
                statusText = "Pendente";
                statusClass = "pendente";
                detailsHtml = `
                    <div class="invitation-details">
                        ⏳ Aguardando resposta
                    </div>
                `;
            }

            const expiraFormat = expiraEm ? expiraEm.toLocaleDateString('pt-BR') : 'A definir';
            
            const card = document.createElement("div");
            card.className = `invitation-card status-${statusClass} ${isExpired ? 'status-expirado' : ''}`;
            card.innerHTML = `
                <div class="invitation-card-header">
                    <h4>Para: ${data.nomeDestinatario} (${data.emailDestinatario || 'Sem email'})</h4>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                ${detailsHtml}
                <div style="font-size: 11px; margin-top: 8px; color: var(--color-text-light);">
                    Validade: ${expiraFormat}
                </div>
                <div class="invitation-actions">
                    ${!isExpired ? `<button class="btn-copy btn-primary" onclick="copyInviteLink('${id}', this)">Copiar Link 🔗</button>` : ""}
                    <button class="btn-delete" onclick="deleteInvite('${id}')">Excluir 🗑️</button>
                </div>
            `;
            listDiv.appendChild(card);
        });
    }, (error) => {
        console.error("Erro no listener de enviados:", error);
    });
}

// 4. Monitoramento em tempo real dos convites Recebidos
function setupReceivedListener(userEmail) {
    const emailRef = userEmail.toLowerCase().trim();
    const q = query(
        collection(db, "convites"),
        where("emailDestinatario", "==", emailRef)
    );

    unsubscribeReceived = onSnapshot(q, (snapshot) => {
        const receivedDiv = document.getElementById("receivedList");
        if (snapshot.empty) {
            receivedDiv.innerHTML = `
                <p style="color: var(--color-text-light); text-align: center; margin-top: 40px; font-size: 13px;">
                    Você ainda não recebeu nenhum convite. 📬
                </p>
            `;
            return;
        }

        // Ordenação manual em memória
        const docSnaps = [];
        snapshot.forEach(docSnap => docSnaps.push(docSnap));
        docSnaps.sort((a, b) => {
            const dateA = a.data().criadoEm ? (a.data().criadoEm.toMillis ? a.data().criadoEm.toMillis() : new Date(a.data().criadoEm).getTime()) : 0;
            const dateB = b.data().criadoEm ? (b.data().criadoEm.toMillis ? b.data().criadoEm.toMillis() : new Date(b.data().criadoEm).getTime()) : 0;
            return dateB - dateA;
        });

        receivedDiv.innerHTML = "";
        const now = new Date();

        docSnaps.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;

            const expiraEm = data.expiraEm ? (data.expiraEm.toDate ? data.expiraEm.toDate() : new Date(data.expiraEm)) : null;
            const isExpired = expiraEm && expiraEm < now;

            let statusText = "Pendente";
            let statusClass = "pendente";
            let detailsHtml = "";

            if (isExpired) {
                statusText = "Expirado";
                statusClass = "expirado";
                detailsHtml = `
                    <div class="invitation-details">
                        ⌛ Este convite expirou antes de ser respondido.
                    </div>
                `;
            } else if (data.status === "aceito" || data.horarioEscolhido) {
                statusText = "Aceito";
                statusClass = "aceito";
                detailsHtml = `
                    <div class="invitation-details">
                        💖 Você marcou este date!<br>
                        📅 <strong>Quando:</strong> ${data.horarioEscolhido || "A definir"}<br>
                        📍 <strong>Lugar:</strong> ${data.alimentoEscolhido || "A definir"}
                    </div>
                `;
            } else {
                statusText = "Pendente";
                statusClass = "pendente";
                detailsHtml = `
                    <div class="invitation-details">
                        📬 <strong>${data.remetenteNome || "Alguém"}</strong> te convidou para sair!
                    </div>
                `;
            }

            const card = document.createElement("div");
            card.className = `invitation-card status-${statusClass} ${isExpired ? 'status-expirado' : ''}`;
            card.innerHTML = `
                <div class="invitation-card-header">
                    <h4>De: ${data.remetenteNome || "Alguém"} (${data.remetenteEmail || 'Sem email'})</h4>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                ${detailsHtml}
                <div class="invitation-actions">
                    ${(!isExpired && data.status !== "aceito" && !data.horarioEscolhido) ? `<a href="/convite/${id}" class="btn-copy btn-primary" style="display:inline-flex; align-items:center; justify-content:center; text-decoration:none; height: 36px; padding: 0 15px; border-radius: 8px;">Ver Convite 📬</a>` : ""}
                </div>
            `;
            receivedDiv.appendChild(card);
        });
    }, (error) => {
        console.error("Erro no listener de recebidos:", error);
    });
}

// 5. Funções globais expostas no escopo window
window.copyInviteLink = function(id, button) {
    const inviteUrl = `${window.location.origin}/convite/${id}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
        const originalText = button.innerHTML;
        button.innerHTML = "✓ Copiado!";
        button.disabled = true;
        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
        }, 2000);
    }).catch(err => {
        console.error("Erro ao copiar link:", err);
        // Fallback
        const temp = document.createElement("input");
        temp.value = inviteUrl;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        document.body.removeChild(temp);
        
        const originalText = button.innerHTML;
        button.innerHTML = "✓ Copiado!";
        button.disabled = true;
        setTimeout(() => {
            button.innerHTML = originalText;
            button.disabled = false;
        }, 2000);
    });
};

window.deleteInvite = async function(id) {
    const confirmDelete = await showModal({
        type: "confirm",
        message: "Tem certeza que deseja excluir permanentemente este convite? 💔"
    });
    if (confirmDelete) {
        try {
            await deleteDoc(doc(db, "convites", id));
        } catch (err) {
            console.error("Erro ao deletar convite:", err);
            await showModal({ type: "alert", message: "Não foi possível excluir o convite." });
        }
    }
};

// 6. Envio do Formulário de Criação de Convites
if (inviteForm) {
    inviteForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const nomeDestinatario = document.getElementById("nomeDestinatario").value.trim();
        const emailDestinatario = document.getElementById("emailDestinatario").value.trim().toLowerCase();
        const mensagemPersonalizada = document.getElementById("mensagemPersonalizada").value.trim();
        const corFundo = document.getElementById("corFundo").value;
        const corCard = document.getElementById("corCard").value;
        
        if (placesArray.length < 2) {
            await showModal({ type: "alert", message: "Você precisa fornecer pelo menos 2 opções de lugares! ⛔" });
            return;
        }

        const opcoesRecusa = [];
        if (recusaList) {
            Array.from(recusaList.children).forEach(child => {
                const input = child.querySelector("input");
                if (input && input.value.trim() !== "") {
                    opcoesRecusa.push(input.value.trim());
                }
            });
        }

        if (opcoesRecusa.length < 2) {
            await showModal({ type: "alert", message: "Você precisa fornecer pelo menos 2 opções de recusa! ⛔" });
            return;
        }

        const btnSubmit = document.getElementById("btnSubmitInvite");
        const originalText = btnSubmit.textContent;
        btnSubmit.disabled = true;
        btnSubmit.textContent = "Salvando...";

        try {
            const user = auth.currentUser;
            if (!user) throw new Error("Usuário não autenticado.");

            // Expira em 14 dias
            const expiraEmDate = new Date();
            expiraEmDate.setDate(expiraEmDate.getDate() + 14);

            // 1. Criar convite no Firestore
            const docRef = await addDoc(collection(db, "convites"), {
                remetenteId: user.uid,
                remetenteNome: userNome,
                remetenteEmail: user.email,
                nomeDestinatario: nomeDestinatario,
                emailDestinatario: emailDestinatario,
                status: "pendente",
                horarioEscolhido: "",
                alimentoEscolhido: "",
                criadoEm: serverTimestamp(),
                expiraEm: expiraEmDate,
                personalizacao: {
                    corFundo: corFundo,
                    corCard: corCard,
                    imagens: ["", "", ""],
                    imagemFundo: "",
                    mensagemPersonalizada: mensagemPersonalizada,
                    lugares: placesArray,
                    opcoesRecusa: opcoesRecusa
                }
            });

            const conviteId = docRef.id;
            const imagensUrls = ["", "", ""];
            let imagemFundoUrl = "";

            // 2. Upload de imagens para o Storage
            const inputIds = ["imgInput1", "imgInput2", "imgInput3"];
            for (let i = 0; i < inputIds.length; i++) {
                const input = document.getElementById(inputIds[i]);
                if (input.files && input.files[0]) {
                    const file = input.files[0];
                    btnSubmit.textContent = `Enviando Imagem ${i+1}...`;
                    
                    const ext = file.name.split('.').pop() || 'webp';
                    const fileRef = ref(storage, `convites/${conviteId}/imagem${i+1}.${ext}`);
                    
                    await uploadBytes(fileRef, file);
                    const downloadUrl = await getDownloadURL(fileRef);
                    imagensUrls[i] = downloadUrl;
                }
            }

            // 3. Upload de imagem de fundo personalizada
            const bgInput = document.getElementById("bgInput");
            if (bgInput.files && bgInput.files[0]) {
                const file = bgInput.files[0];
                btnSubmit.textContent = "Enviando Imagem de Fundo...";
                const ext = file.name.split('.').pop() || 'webp';
                const fileRef = ref(storage, `convites/${conviteId}/fundo.${ext}`);
                await uploadBytes(fileRef, file);
                imagemFundoUrl = await getDownloadURL(fileRef);
            }

            // 4. Atualizar o Firestore com as URLs finais
            await updateDoc(docRef, {
                "personalizacao.imagens": imagensUrls,
                "personalizacao.imagemFundo": imagemFundoUrl
            });

            // Exibir link destacado com feedback
            const generatedLinkContainer = document.getElementById("generatedLinkContainer");
            const generatedLinkInput = document.getElementById("generatedLinkInput");
            const btnCopyGenerated = document.getElementById("btnCopyGenerated");

            const inviteUrl = `${window.location.origin}/convite/${conviteId}`;
            generatedLinkInput.value = inviteUrl;
            generatedLinkContainer.style.display = "block";
            generatedLinkContainer.scrollIntoView({ behavior: "smooth" });

            btnCopyGenerated.onclick = () => {
                navigator.clipboard.writeText(inviteUrl).then(() => {
                    btnCopyGenerated.textContent = "✓ Copiado!";
                    setTimeout(() => {
                        btnCopyGenerated.textContent = "Copiar Link";
                    }, 2000);
                }).catch(err => {
                    console.error("Erro ao copiar:", err);
                    generatedLinkInput.select();
                    document.execCommand("copy");
                    btnCopyGenerated.textContent = "✓ Copiado!";
                    setTimeout(() => {
                        btnCopyGenerated.textContent = "Copiar Link";
                    }, 2000);
                });
            };

            await showModal({ type: "alert", message: "Convite criado com sucesso! 🎉" });
            inviteForm.reset();
            
            // Resetar previews de imagem
            for (let i = 1; i <= 3; i++) {
                document.getElementById(`imgPrev${i}`).style.display = 'none';
                document.getElementById(`imgPrev${i}`).src = '';
                document.getElementById(`imgIcon${i}`).style.display = 'block';
                document.getElementById(`imgText${i}`).style.display = 'block';
            }

            // Resetar preview de fundo
            document.getElementById("bgPrev").style.display = 'none';
            document.getElementById("bgPrev").src = '';
            document.getElementById("bgIcon").style.display = 'block';
            document.getElementById("bgText").style.display = 'block';
            
            // Resetar lugares para o padrão
            placesArray.length = 0;
            addLugarItem("🍕", "Pizza");
            addLugarItem("🍣", "Sushi");

            // Resetar recusas para o padrão
            if (recusaList) {
                recusaList.innerHTML = "";
                addRecusaField("não...");
                addRecusaField("tem certeza? 🤔");
            }

        } catch (err) {
            console.error("Erro ao criar convite:", err);
            await showModal({ type: "alert", message: "Erro ao criar convite. Verifique as configurações." });
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = originalText;
        }
    });
}

// 7. Monitorar estado de autenticação
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    
    // Obter dados do usuário no Firestore
    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists() && userSnap.data().nome) {
            userNome = userSnap.data().nome;
        } else {
            userNome = user.displayName || "Remetente";
        }
        document.getElementById("userName").textContent = userNome;
    } catch (e) {
        console.error("Erro ao obter dados do usuário:", e);
        userNome = user.displayName || "Remetente";
        document.getElementById("userName").textContent = userNome;
    }

    // Inicializar listeners em tempo real com validações robustas
    setupSentListener(user.uid);
    if (user.email) {
        setupReceivedListener(user.email.toLowerCase().trim());
    } else {
        document.getElementById("receivedList").innerHTML = `
            <p style="color: var(--color-text-light); text-align: center; margin-top: 40px; font-size: 13px;">
                Email não identificado para o carregamento de recebidos.
            </p>
        `;
    }

    // Rodar limpeza silenciosa de expirados
    cleanExpiredInvites(user.uid);
});

// Botão Sair
const btnLogout = document.getElementById("btnLogout");
if (btnLogout) {
    btnLogout.addEventListener("click", () => {
        signOut(auth).then(() => {
            if (unsubscribeSent) unsubscribeSent();
            if (unsubscribeReceived) unsubscribeReceived();
            window.location.href = "index.html";
        }).catch(err => {
            console.error("Erro ao fazer logout:", err);
        });
    });
}
