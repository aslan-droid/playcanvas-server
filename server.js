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

    // Odada 0 numaralı karakter (1. Oyuncu) var mı kontrol et, varsa yeni gelene 1 (2. Oyuncu) ver
    const existingRoles = Object.values(players).map(p => p.charType);
    const assignedChar = existingRoles.includes(0) ? 1 : 0;

    // 1. Oyuncu solda (-3), 2. Oyuncu sağda (+3) doğsun ki üst üste binmesinler
    const startX = assignedChar === 0 ? -3 : 3;

    players[socket.id] = {
        id: socket.id,
        charType: assignedChar, // 0 = Karakter A, 1 = Karakter B
        x: startX,
        y: 1,
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