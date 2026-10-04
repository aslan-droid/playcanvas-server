const PORT = process.env.PORT || 3000;

const io = require('socket.io')(PORT, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

const players = {};

console.log(`Sunucu ${PORT} portunda çalışıyor...`);

io.on('connection', (socket) => {
    console.log('Yeni oyuncu bağlandı:', socket.id);

    // Odadaki mevcut oyuncuların karakter tiplerine bak:
    const existingRoles = Object.values(players).map(p => p.charType);
    // Odada 0 (Model1) yoksa yeni gelene 0 ver, varsa 1 (Model2) ver:
    const assignedChar = existingRoles.includes(0) ? 1 : 0;

    // 1. Oyuncu solda (-2), 2. Oyuncu sağda (+2) doğsun:
    const startX = assignedChar === 0 ? -2 : 2;

    players[socket.id] = {
        id: socket.id,
        charType: assignedChar, // <-- İşte eksik olan kısım burasıydı!
        x: startX,
        y: 0, // Yere basmaları için 0 yaptık
        z: 0
    };

    socket.emit('initPlayers', { myId: socket.id, players: players });
    socket.broadcast.emit('playerJoined', players[socket.id]);

    socket.on('move', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].z = data.z;
            socket.broadcast.emit('playerMoved', players[socket.id]);
        }
    });

    socket.on('disconnect', () => {
        console.log('Oyuncu ayrıldı:', socket.id);
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
    });
});