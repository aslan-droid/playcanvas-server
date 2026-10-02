// Render'ın verdiği portu kullan, yoksa 3000'i kullan:
const PORT = process.env.PORT || 3000;

const io = require('socket.io')(PORT, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const players = {};

console.log(`Sunucu ${PORT} portunda çalışıyor...`);

io.on('connection', (socket) => {
    console.log('Yeni oyuncu bağlandı:', socket.id);

    players[socket.id] = { id: socket.id, x: 0, y: 1, z: 0 };

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