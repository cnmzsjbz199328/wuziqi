var stompClient = null;

function connect() {
    var socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.connect({}, function (frame) {
        console.log('Connected: ' + frame);
        stompClient.subscribe('/topic/game', function (message) {
            showMove(JSON.parse(message.body));
        });
    });
}

function sendMove(row, col) {
    stompClient.send("/app/move", {}, JSON.stringify({'row': row, 'col': col}));
}

function resetGame() {
    stompClient.send("/app/reset", {}, {});
}

function showMove(message) {
    // Code to update the game board on the web page
}

connect();
