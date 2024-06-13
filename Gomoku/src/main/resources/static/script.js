var stompClient = null;

function connect() {
    var socket = new SockJS('/ws');
    stompClient = Stomp.over(socket);
    stompClient.connect({}, function (frame) {
        console.log('Connected: ' + frame);
        stompClient.subscribe('/topic/users', function (message) {
            updateUsers(JSON.parse(message.body));
        });
    });
}

function updateUsers(users) {
    var usersList = document.getElementById('users');
    usersList.innerHTML = '';
    users.forEach(function(user) {
        var li = document.createElement('li');
        li.textContent = user.name + " - Score: " + user.score;
        usersList.appendChild(li);
    });
}

function makeMove(row, col) {
    fetch('/game/move', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ row: row, col: col })
    })
    .then(response => response.json())
    .then(data => {
        updateBoard(data.board);
        if (data.winner) {
            alert(data.winner + ' wins!');
            updateUsers(data.users);
            if (data.poem) {
                displayPoem(data.poem);  // Display the poem
            }
        }
    });
}

function displayPoem(poem) {
    const gameTitle = document.getElementById('game-title');
    gameTitle.style.display = 'none'; // Hide game title
    const poemSection = document.getElementById('poem-section');
    const poemElement = document.getElementById('poem');
    poemElement.textContent = poem; // Adjust based on actual data structure
    poemSection.style.display = 'block';
    poemSection.style.width = '0'; // Reset width before animation
    poemSection.classList.add('typewriter'); // Add typewriter effect

    // Reset animation by removing and re-adding the class
    poemSection.classList.remove('typewriter');
    void poemSection.offsetWidth; // Trigger reflow
    poemSection.classList.add('typewriter');

    console.log(poem); // 添加这一行
    poemElement.textContent = poem;

}

function updateBoard(board) {
    if (!Array.isArray(board) || !Array.isArray(board[0])) {
        console.error('Invalid board data:', board);
        return;
    }
    const table = document.getElementById('board');
    table.innerHTML = '';
    for (let i = 0; i < board.length; i++) {
        let row = table.insertRow();
        for (let j = 0; j < board[i].length; j++) {
            let cell = row.insertCell();
            cell.innerText = board[i][j] ? board[i][j] : '';
            cell.onclick = () => makeMove(i, j);
        }
    }
}

function registerPlayer() {
    var username = document.getElementById('username').value;
    fetch('/game/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'username=' + encodeURIComponent(username)
    })
    .then(response => response.json()) // 修改点3：期待返回JSON数据
    .then(data => {
         alert(data.message);
         updateUsers(data.users); // 修改点4：更新用户列表，显示最新分数
    });
}

function setStrategy() {
    var strategy = document.getElementById('strategy').value;
    fetch('/game/strategy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'strategy=' + encodeURIComponent(strategy)
    });
}

window.onload = function() {
    connect();
    createBoard();
    fetch('/game/users')
            .then(response => response.json())
            .then(data => {
                updateUsers(data); // 修改点5：更新用户列表，显示最新分数
            });
}

function createBoard() {
    const table = document.getElementById('board');
    for (let i= 0; i < 15; i++) {
       let row = table.insertRow();
       for (let j = 0; j < 15; j++) {
       let cell = row.insertCell();
       cell.onclick = () => makeMove(i, j);
                      }
                  }
              }
