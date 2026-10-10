const PORT = process.env.PORT || 3000;

const io = require('socket.io')(PORT, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// ---------------------------------------------------------------------------
// AYARLAR
// ---------------------------------------------------------------------------

// Oyunda hazır olan karakter sayısı. 3. ve 4. karakteri Movement'a ekleyince 4 yap.
const CHARACTER_COUNT = 2;

// Oyuncuların doğacağı noktalar (sırayla boş olan verilir). İstediğin kadar ekleyebilirsin.
const SPAWN_POINTS = [
    { x: -2, z: 0 },
    { x: 2, z: 0 },
    { x: -2, z: 3 },
    { x: 2, z: 3 },
    { x: -2, z: -3 },
    { x: 2, z: -3 }
];

const VALID_ANIMS = ['Idle', 'Walk', 'Sit'];

// ---------------------------------------------------------------------------
// DURUM
// ---------------------------------------------------------------------------

const players = {}; // socketId -> oyuncu bilgisi
const seats = {};   // seatId (sandalye GUID'i) -> oturan oyuncunun socketId'si

console.log(`Sunucu ${PORT} portunda çalışıyor...`);

// Şu an en az kullanılan karakter tipini seç (hepsi eşitse en küçük numara)
function pickCharType() {
    const counts = new Array(CHARACTER_COUNT).fill(0);
    Object.values(players).forEach(p => { counts[p.charType % CHARACTER_COUNT]++; });
    let best = 0;
    for (let i = 1; i < CHARACTER_COUNT; i++) {
        if (counts[i] < counts[best]) best = i;
    }
    return best;
}

// Boş olan ilk doğma noktasını seç
function pickSpawnIndex() {
    const used = new Set(Object.values(players).map(p => p.spawnIndex));
    for (let i = 0; i < SPAWN_POINTS.length; i++) {
        if (!used.has(i)) return i;
    }
    return Object.keys(players).length % SPAWN_POINTS.length;
}

// Oyuncunun oturduğu sandalyeyi boşalt. Bir şey değiştiyse true döner.
function releaseSeatOf(socketId) {
    let changed = false;
    for (const seatId in seats) {
        if (seats[seatId] === socketId) {
            delete seats[seatId];
            changed = true;
        }
    }
    if (players[socketId]) players[socketId].seatId = null;
    return changed;
}

function isNum(v) {
    return typeof v === 'number' && Number.isFinite(v);
}

// ---------------------------------------------------------------------------
// BAĞLANTI
// ---------------------------------------------------------------------------

io.on('connection', (socket) => {
    console.log('Yeni oyuncu bağlandı:', socket.id);

    const charType = pickCharType();
    const spawnIndex = pickSpawnIndex();
    const spawn = SPAWN_POINTS[spawnIndex];

    players[socket.id] = {
        id: socket.id,
        charType: charType,
        spawnIndex: spawnIndex,
        x: spawn.x,
        y: 0,
        z: spawn.z,
        anim: 'Idle',
        rotY: 0,
        seatId: null
    };

    socket.emit('initPlayers', { myId: socket.id, players: players, seats: seats });
    socket.broadcast.emit('playerJoined', players[socket.id]);

    // Hareket + animasyon durumu
    socket.on('move', (data) => {
        const p = players[socket.id];
        if (!p || !data) return;

        if (isNum(data.x) && isNum(data.y) && isNum(data.z)) {
            p.x = data.x;
            p.y = data.y;
            p.z = data.z;
        }
        if (isNum(data.rotY)) p.rotY = data.rotY;
        if (VALID_ANIMS.includes(data.anim)) p.anim = data.anim;

        socket.broadcast.emit('playerMoved', {
            id: p.id,
            x: p.x, y: p.y, z: p.z,
            rotY: p.rotY,
            anim: p.anim,
            seatId: p.seatId
        });
    });

    // Oturma isteği: sandalye boşsa onaylanır (iki kişi aynı sandalyeye oturamaz)
    socket.on('sitRequest', (data, ack) => {
        const reply = (typeof ack === 'function') ? ack : () => {};
        const p = players[socket.id];
        const seatId = (data && typeof data.seatId === 'string') ? data.seatId : null;

        if (!p || !seatId || seatId.length > 64) return reply({ ok: false, reason: 'invalid' });
        if (seats[seatId] && seats[seatId] !== socket.id) return reply({ ok: false, reason: 'occupied' });

        releaseSeatOf(socket.id); // başka sandalyedeyse önce oradan kalk
        seats[seatId] = socket.id;
        p.seatId = seatId;

        reply({ ok: true, seatId: seatId });
        io.emit('seatsUpdate', seats);
    });

    socket.on('standUp', () => {
        if (releaseSeatOf(socket.id)) io.emit('seatsUpdate', seats);
    });

    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        const seatChanged = releaseSeatOf(socket.id);
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
        if (seatChanged) io.emit('seatsUpdate', seats);
    });
});