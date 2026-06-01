// Variabili globali per la scena 3D
let scene, camera, renderer;
let raycaster, mouse;
let rockMesh, paperMesh, scissorsMesh;
let selectableObjects = [];
let animationId;
let sceneState = 'IDLE'; // IDLE, SELECTING, WAITING, CLASHING
let onChoiceMadeCallback = null;

let myActiveMesh = null;
let oppActiveMesh = null;

// Inizializzazione Three.js
function init3D() {
    const canvas = document.getElementById('game-canvas');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Colore di sfondo scuro

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 10;
    camera.position.y = 2;

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Luci
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    // Raycaster per i click
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    createModels();

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('click', onClick, false);

    animate();
}

// Creazione dei modelli base
function createModels() {
    // 1. Sasso (Dodecaedro)
    const rockGeo = new THREE.DodecahedronGeometry(1.5, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8 });
    rockMesh = new THREE.Mesh(rockGeo, rockMat);
    rockMesh.userData = { choice: 'sasso' };
    
    // 2. Carta (Cubo Piatto)
    const paperGeo = new THREE.BoxGeometry(2, 2.5, 0.2);
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    paperMesh = new THREE.Mesh(paperGeo, paperMat);
    paperMesh.userData = { choice: 'carta' };

    // 3. Forbici (Due cilindri incrociati raggruppati)
    scissorsMesh = new THREE.Group();
    const scisMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.5 });
    const cyl1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3), scisMat);
    cyl1.rotation.z = Math.PI / 4;
    const cyl2 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3), scisMat);
    cyl2.rotation.z = -Math.PI / 4;
    scissorsMesh.add(cyl1);
    scissorsMesh.add(cyl2);
    // Aggiungiamo un hitbox invisibile per il raycasting sul gruppo
    const hitGeo = new THREE.BoxGeometry(2.5, 2.5, 0.5);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitBox = new THREE.Mesh(hitGeo, hitMat);
    hitBox.userData = { choice: 'forbici' };
    scissorsMesh.add(hitBox);
    scissorsMesh.userData = { choice: 'forbici', isGroup: true };

    // Posizioniamo fuori schermo inizialmente
    hideAllModels();
}

function hideAllModels() {
    scene.remove(rockMesh);
    scene.remove(paperMesh);
    scene.remove(scissorsMesh);
    selectableObjects = [];
}

function startSelection(callback) {
    onChoiceMadeCallback = callback;
    sceneState = 'SELECTING';
    hideAllModels();
    
    // Rimuoviamo i mesh attivi (se ce n'erano dal round precedente)
    if(myActiveMesh) scene.remove(myActiveMesh);
    if(oppActiveMesh) scene.remove(oppActiveMesh);

    // Ripristina posizioni per la selezione
    rockMesh.position.set(-4, 0, 0);
    rockMesh.rotation.set(0,0,0);
    rockMesh.scale.set(1,1,1);
    scene.add(rockMesh);

    paperMesh.position.set(0, 0, 0);
    paperMesh.rotation.set(0,0,0);
    paperMesh.scale.set(1,1,1);
    scene.add(paperMesh);

    scissorsMesh.position.set(4, 0, 0);
    scissorsMesh.rotation.set(0,0,0);
    scissorsMesh.scale.set(1,1,1);
    scene.add(scissorsMesh);

    // Hitbox delle forbici è quello da cliccare
    selectableObjects = [rockMesh, paperMesh, scissorsMesh.children.find(c => c.geometry.type === 'BoxGeometry')];
}

function showWaitingOpponent(myChoice) {
    sceneState = 'WAITING';
    hideAllModels();

    // Clona il mesh scelto per mostrarlo
    myActiveMesh = cloneChoiceMesh(myChoice);
    myActiveMesh.position.set(0, 0, 2);
    scene.add(myActiveMesh);
}

function showClash(myChoice, oppChoice, result) {
    sceneState = 'CLASHING';
    hideAllModels();
    if(myActiveMesh) scene.remove(myActiveMesh);
    
    myActiveMesh = cloneChoiceMesh(myChoice);
    myActiveMesh.position.set(-3, 0, 0);
    scene.add(myActiveMesh);

    oppActiveMesh = cloneChoiceMesh(oppChoice);
    oppActiveMesh.position.set(3, 0, 0);
    // ruotiamo l'avversario per affrontarci
    oppActiveMesh.rotation.y = Math.PI; 
    scene.add(oppActiveMesh);

    // Semplice animazione di scontro
    let t = 0;
    const clashAnim = () => {
        t += 0.05;
        if (t <= 1) {
            myActiveMesh.position.x = -3 + 2 * t; // si sposta verso il centro
            oppActiveMesh.position.x = 3 - 2 * t;
            requestAnimationFrame(clashAnim);
        } else {
            // Effetto post scontro
            if (result === 'win') {
                oppActiveMesh.position.y -= 1;
                oppActiveMesh.rotation.z += 1;
            } else if (result === 'lose') {
                myActiveMesh.position.y -= 1;
                myActiveMesh.rotation.z -= 1;
            }
            // draw: non fa nulla, rimbalzano
        }
    };
    clashAnim();
}

function cloneChoiceMesh(choice) {
    let mesh;
    if (choice === 'sasso') {
        mesh = new THREE.Mesh(rockMesh.geometry, rockMesh.material);
    } else if (choice === 'carta') {
        mesh = new THREE.Mesh(paperMesh.geometry, paperMesh.material);
    } else if (choice === 'forbici') {
        // clona il gruppo
        mesh = scissorsMesh.clone();
    }
    return mesh;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onClick(event) {
    if (sceneState !== 'SELECTING') return;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(selectableObjects);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        const choice = object.userData.choice;
        if (choice && onChoiceMadeCallback) {
            onChoiceMadeCallback(choice);
        }
    }
}

function animate() {
    animationId = requestAnimationFrame(animate);

    // Animazione idle lenta
    if (sceneState === 'SELECTING') {
        rockMesh.rotation.x += 0.005;
        rockMesh.rotation.y += 0.01;
        
        paperMesh.rotation.y += 0.01;

        scissorsMesh.rotation.y += 0.01;
    } else if (sceneState === 'WAITING' && myActiveMesh) {
        myActiveMesh.rotation.y += 0.02;
    }

    renderer.render(scene, camera);
}

// Inizializza subito
init3D();
