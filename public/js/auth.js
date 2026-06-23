import { auth, db } from "./firebase-config.js";
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Redirecionamento automático caso já esteja logado
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = "dashboard.html";
    }
});

// Registrar Usuário no Firestore
async function saveUserToFirestore(user, name) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
        await setDoc(userRef, {
            nome: name || user.displayName || "Usuário",
            email: user.email,
            criadoEm: serverTimestamp()
        });
    }
}

// 1. Lógica do Formulário de Login
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("loginEmail").value.trim();
        const password = document.getElementById("loginPassword").value;
        const btn = loginForm.querySelector("button[type='submit']");
        const originalText = btn.textContent;

        btn.disabled = true;
        btn.textContent = "Entrando...";

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // O onAuthStateChanged fará o redirecionamento
        } catch (error) {
            console.error("Erro no login:", error);
            let msg = "Erro ao fazer login. Verifique suas credenciais.";
            if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
                msg = "Email ou senha incorretos! ⛔";
            } else if (error.code === "auth/invalid-email") {
                msg = "Formato de email inválido! ⛔";
            }
            alert(msg);
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}

// 2. Lógica do Formulário de Cadastro
const registerForm = document.getElementById("registerForm");
if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("registerName").value.trim();
        const email = document.getElementById("registerEmail").value.trim();
        const password = document.getElementById("registerPassword").value;
        const btn = registerForm.querySelector("button[type='submit']");
        const originalText = btn.textContent;

        if (password.length < 6) {
            alert("A senha precisa ter no mínimo 6 caracteres! 🔑");
            return;
        }

        btn.disabled = true;
        btn.textContent = "Cadastrando...";

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await saveUserToFirestore(userCredential.user, name);
            // O onAuthStateChanged fará o redirecionamento
        } catch (error) {
            console.error("Erro no cadastro:", error);
            let msg = "Erro ao criar conta. Tente novamente.";
            if (error.code === "auth/email-already-in-use") {
                msg = "Este email já está em uso! ⛔";
            } else if (error.code === "auth/invalid-email") {
                msg = "Formato de email inválido! ⛔";
            }
            alert(msg);
            btn.disabled = false;
            btn.textContent = originalText;
        }
    });
}

// 3. Lógica do Login com Google OAuth
const btnGoogle = document.getElementById("btnGoogle");
if (btnGoogle) {
    btnGoogle.addEventListener("click", async () => {
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            await saveUserToFirestore(result.user, null);
            // O onAuthStateChanged fará o redirecionamento
        } catch (error) {
            console.error("Erro no Google Auth:", error);
            if (error.code !== "auth/popup-closed-by-user") {
                alert("Ocorreu um erro ao fazer login com o Google. ⛔");
            }
        }
    });
}
