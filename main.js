// main.js - Logica di Gioco e Multiplayer con PeerJS

// Variabili di stato
let peer = null;
let conn = null;
let isHost = false;

let myScore = 0;
let oppScore = 0;
const MAX_WINS = 3; // Alla meglio di 5 (chi arriva a 3 vince)

let myChoice = null;
let oppChoice = null;
let roundCount = 0;

let myName = "";
let oppName = "Avversario";

// Elementi DOM
const screenMain = document.getElementById('screen-main');
const screenWaiting = document.getElementById('screen-waiting');
const screenGame = document.getElementById('screen-game');
const screenResult = document.getElementById('screen-result');

const btnCreate = document.getElementById('btn-create');
const btnJoin = document.getElementById('btn-join');
const inputJoinCode = document.getElementById('input-join-code');
const inputPlayerName = document.getElementById('input-player-name');
const displayRoomCode = document.getElementById('display-room-code');
const mainError = document.getElementById('main-error');
const gameStatus = document.getElementById('game-status');
const scoreYou = document.getElementById('score-you');
const scoreOpponent = document.getElementById('score-opponent');

const labelYou = document.getElementById('label-you');
const labelOpponent = document.getElementById('label-opponent');

const finalResultTitle = document.getElementById('final-result-title');
const finalResultText = document.getElementById('final-result-text');
const btnRematch = document.getElementById('btn-rematch');

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

function updateStatus(stateClass, text) {
    statusDot.className = 'status-dot ' + stateClass;
    statusText.textContent = text;
}

// Utility UI
function showScreen(screenEl) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screenEl.classList.add('active');
}

function showError(msg) {
    mainError.textContent = msg;
    mainError.classList.remove('hidden');
}

function initializeMyName(hostFlag) {
    let inputName = inputPlayerName.value.trim();
    if (inputName.length === 0) {
        myName = hostFlag ? "Giocatore 1" : "Giocatore 2";
    } else {
        myName = inputName;
    }
    labelYou.textContent = myName;
}

// --- LOGICA PEERJS ---

// Genera un ID corto casuale per semplificare l'inserimento
function generateShortId() {
    return Math.floor(1000 + Math.random() * 9000).toString(); // Es. "4592"
}

// Host crea la stanza
btnCreate.addEventListener('click', () => {
    console.log("Creazione stanza iniziata...");
    btnCreate.disabled = true;
    btnCreate.textContent = "Connessione al server...";
    updateStatus('connecting', 'Connessione al server...');
    
    initializeMyName(true);

    const roomId = "fcs-" + generateShortId(); 
    
    try {
        peer = new Peer(roomId, {
            debug: 2 // Mostra log dettagliati nel console per il debug
        });
        
        console.log("Oggetto Peer creato con ID:", roomId);
    } catch (e) {
        console.error("Errore fatale nella creazione di Peer:", e);
        showError("Impossibile inizializzare la connessione WebRTC.");
        btnCreate.disabled = false;
        btnCreate.textContent = "Crea Partita";
        return;
    }

    peer.on('open', (id) => {
        console.log("Connesso al PeerServer! ID assegnato:", id);
        updateStatus('server', "In attesa dell'avversario");
        isHost = true;
        const code = id.replace("fcs-", "");
        displayRoomCode.textContent = code;
        showScreen(screenWaiting);
        
        // Reset button for future uses
        btnCreate.disabled = false;
        btnCreate.textContent = "Crea Partita";
    });

    peer.on('connection', (connection) => {
        console.log("Un Guest si è connesso!");
        conn = connection;
        setupConnection();
    });

    peer.on('error', (err) => {
        console.error("PeerJS Error:", err);
        updateStatus('', 'Errore di connessione');
        showError("Errore durante la creazione: " + err.type);
        btnCreate.disabled = false;
        btnCreate.textContent = "Crea Partita";
    });
});

// Guest si unisce
btnJoin.addEventListener('click', () => {
    const code = inputJoinCode.value.trim();
    if (code.length === 0) {
        showError("Inserisci un codice valido.");
        return;
    }

    initializeMyName(false);

    console.log("Tentativo di unione con codice:", code);
    btnJoin.disabled = true;
    btnJoin.textContent = "Ricerca Host...";
    updateStatus('connecting', 'Ricerca Host...');

    peer = new Peer({ debug: 2 }); // ID generato automaticamente per il guest

    peer.on('open', (id) => {
        console.log("Guest connesso al PeerServer. ID:", id);
        updateStatus('connecting', "Connessione all'host...");
        isHost = false;
        // Tenta la connessione all'host
        const hostId = "fcs-" + code;
        console.log("Connessione all'host:", hostId);
        
        conn = peer.connect(hostId, { reliable: true });
        
        conn.on('open', () => {
            console.log("Connessione P2P stabilita con successo!");
            setupConnection();
            btnJoin.disabled = false;
            btnJoin.textContent = "Unisciti";
        });

        conn.on('error', (err) => {
            console.error("Errore connessione DataChannel:", err);
            updateStatus('', 'Disconnesso');
            showError("La connessione con l'host è caduta.");
            btnJoin.disabled = false;
            btnJoin.textContent = "Unisciti";
        });
    });

    peer.on('error', (err) => {
        console.error("PeerJS Error sul Guest:", err);
        updateStatus('', 'Errore di connessione');
        if (err.type === 'peer-unavailable') {
            showError("Host non trovato. L'avversario ha chiuso la pagina o il codice è errato.");
        } else {
            showError("Errore WebRTC: " + err.type);
        }
        btnJoin.disabled = false;
        btnJoin.textContent = "Unisciti";
    });
});

// Configura la connessione una volta stabilita
function setupConnection() {
    updateStatus('connected', 'Connesso P2P');
    showScreen(screenGame);
    startGame();

    // Invio il mio nome all'avversario
    setTimeout(() => {
        sendNetworkData({ type: 'INFO', name: myName });
    }, 500);

    conn.on('data', (data) => {
        handleNetworkData(data);
    });

    conn.on('close', () => {
        updateStatus('', 'Disconnesso');
        alert("L'avversario si è disconnesso.");
        location.reload();
    });
}

function sendNetworkData(data) {
    if (conn && conn.open) {
        conn.send(data);
    }
}

// Gestione messaggi P2P
function handleNetworkData(data) {
    if (data.type === 'INFO') {
        oppName = data.name || (isHost ? "Giocatore 2" : "Giocatore 1");
        labelOpponent.textContent = oppName;
    } else if (data.type === 'CHOICE') {
        oppChoice = data.choice;
        checkRoundResult();
    } else if (data.type === 'REMATCH') {
        resetGameStats();
        startGame();
    }
}

// --- LOGICA DI GIOCO ---

function startGame() {
    showScreen(screenGame);
    myChoice = null;
    oppChoice = null;
    updateScoreUI();
    gameStatus.textContent = "Scegli la tua mossa!";
    
    // Mostra modelli 3D e attiva selezione (da scene.js)
    if (typeof startSelection === "function") {
        startSelection(onLocalChoiceMade);
    }
}

function onLocalChoiceMade(choice) {
    myChoice = choice;
    gameStatus.textContent = `Hai scelto ${choice.toUpperCase()}. In attesa di ${oppName}...`;
    
    // Aggiorna 3D
    if (typeof showWaitingOpponent === "function") {
        showWaitingOpponent(myChoice);
    }

    // Invia all'avversario
    sendNetworkData({ type: 'CHOICE', choice: myChoice });

    checkRoundResult();
}

function checkRoundResult() {
    if (myChoice && oppChoice) {
        // Entrambi hanno scelto
        const result = determineWinner(myChoice, oppChoice);
        let statusMsg = "";

        if (result === 'win') {
            myScore++;
            statusMsg = `Hai Vinto il round! (Tu: ${myChoice}, ${oppName}: ${oppChoice})`;
        } else if (result === 'lose') {
            oppScore++;
            statusMsg = `Hai Perso il round. (Tu: ${myChoice}, ${oppName}: ${oppChoice})`;
        } else {
            statusMsg = `Pareggio! (Entrambi: ${myChoice})`;
        }

        updateScoreUI();
        gameStatus.textContent = statusMsg;

        // Mostra scontro in 3D
        if (typeof showClash === "function") {
            showClash(myChoice, oppChoice, result);
        }

        // Controlla se qualcuno ha vinto la partita intera
        if (myScore >= MAX_WINS || oppScore >= MAX_WINS) {
            setTimeout(endGame, 3000); // Aspetta 3 secondi per vedere l'animazione
        } else {
            // Prossimo round
            setTimeout(startGame, 3000);
        }
    }
}

function determineWinner(c1, c2) {
    if (c1 === c2) return 'draw';
    if (
        (c1 === 'sasso' && c2 === 'forbici') ||
        (c1 === 'carta' && c2 === 'sasso') ||
        (c1 === 'forbici' && c2 === 'carta')
    ) {
        return 'win';
    }
    return 'lose';
}

function updateScoreUI() {
    scoreYou.textContent = myScore;
    scoreOpponent.textContent = oppScore;
}

function endGame() {
    showScreen(screenResult);
    if (myScore >= MAX_WINS) {
        finalResultTitle.textContent = "VITTORIA!";
        finalResultText.textContent = `Hai vinto ${myScore} a ${oppScore} contro ${oppName}.`;
        finalResultTitle.style.color = "var(--success)";
    } else {
        finalResultTitle.textContent = "SCONFITTA!";
        finalResultText.textContent = `Hai perso ${myScore} a ${oppScore} contro ${oppName}.`;
        finalResultTitle.style.color = "var(--danger)";
    }
    
    // Rimuovi modelli 3D
    if (typeof hideAllModels === "function") hideAllModels();
}

function resetGameStats() {
    myScore = 0;
    oppScore = 0;
    myChoice = null;
    oppChoice = null;
    updateScoreUI();
}

btnRematch.addEventListener('click', () => {
    sendNetworkData({ type: 'REMATCH' });
    resetGameStats();
    startGame();
});
