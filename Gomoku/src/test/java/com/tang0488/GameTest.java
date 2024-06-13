package com.tang0488;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class GameTest {

    @Test
    public void testScoreAfterWin() {
        UserPool userPool = new UserPool();
        User user = new User("TestPlayer");
        userPool.addUser(user);
        Board board = new Board();
        RandomMoveStrategy randomMoveStrategy = new RandomMoveStrategy();
        SmartMoveStrategy smartMoveStrategy = new SmartMoveStrategy(randomMoveStrategy);
        Game game = new Game(userPool, randomMoveStrategy, smartMoveStrategy);

        // 模拟一次游戏中玩家赢得比赛
        for (int col = 0; col < 5; col++) {
            board.addMove(0, col, user.getName());
        }
        if (board.checkWin(user.getName())) {
            int clearedCount = board.clearWinningLine(user.getName());
            user.addScore(clearedCount); // 确认分数增加操作是否正确执行
        }

        // 期待的分数，假设每清除5个连珠得1分
        assertEquals(1, user.getScore(), "Score should be incremented correctly after winning.");
    }
}
