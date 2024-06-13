package com.tang0488;

import com.tang0488.Poem.Poem;
import com.tang0488.Poem.PoemService;

public class Main {

    public static void main(String[] args) {
        // 模拟注入依赖项
        UserPool userPool = new UserPool();
        RandomMoveStrategy randomMoveStrategy = new RandomMoveStrategy();
        SmartMoveStrategy smartMoveStrategy = new SmartMoveStrategy(randomMoveStrategy);
        PoemService poemService = new PoemService();
        Game game = new Game(userPool, randomMoveStrategy, smartMoveStrategy,poemService);

        // 添加模拟玩家
        userPool.addUser(new User("Player1"));
        userPool.addUser(new User("Player2"));

        // 初始化游戏（确保此方法会设置玩家）
        game.initializePlayers();

        // 开始游戏
        game.start();

//        // 模拟玩家操作，这里我们手动调用方法来模拟玩家下棋
//        game.makeMove(0, 0); // Player1
//        game.makeMove(0, 1); // Player2
//        game.makeMove(1, 0); // Player1
//        game.makeMove(1, 1); // Player2
//        game.makeMove(2, 0); // Player1
//        game.makeMove(2, 1); // Player2
//        game.makeMove(3, 0); // Player1
//        game.makeMove(3, 1); // Player2
//        game.makeMove(4, 0); // Player1，假设这是获胜的一步
//
//        // 检查是否获胜并更新分数
//        if (game.getBoard().checkWin(game.getCurrentPlayer())) {
//            int scoreAdded = game.getBoard().clearWinningLine(game.getCurrentPlayer());
//            User currentPlayer = userPool.findByUsername(game.getCurrentPlayer());
//            currentPlayer.addScore(scoreAdded);
//            System.out.println(currentPlayer.getName() + " wins with score: " + currentPlayer.getScore());
//        }
//
//        // 输出所有玩家分数
//        for (User user : userPool.getUsers()) {
//            System.out.println("Score of " + user.getName() + ": " + user.getScore());
//        }
    }
}
