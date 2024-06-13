package com.tang0488;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class BoardTest {

    @Test
    public void testClearWinningLine_HorizontalWin() {
        Board board = new Board();
        User testUser = new User("TestPlayer");
        // 假设横向赢得游戏的布局
        for (int col = 0; col < 5; col++) {
            board.addMove(0, col, testUser.getName());
        }
        int clearedCount = board.clearWinningLine(testUser.getName());
        assertEquals(1, clearedCount);  // 假设每5个连珠清除1个棋子
    }

    @Test
    public void testClearWinningLine_VerticalWin() {
        Board board = new Board();
        User testUser = new User("TestPlayer");
        // 假设纵向赢得游戏的布局
        for (int row = 0; row < 5; row++) {
            board.addMove(row, 0, testUser.getName());
        }
        int clearedCount = board.clearWinningLine(testUser.getName());
        assertEquals(1, clearedCount);  // 假设每5个连珠清除1个棋子
    }

    @Test
    public void testClearWinningLine_DiagonalWin() {
        Board board = new Board();
        User testUser = new User("TestPlayer");
        // 假设对角线赢得游戏的布局
        for (int i = 0; i < 5; i++) {
            board.addMove(i, i, testUser.getName());
        }
        int clearedCount = board.clearWinningLine(testUser.getName());
        assertEquals(1, clearedCount);  // 假设每5个连珠清除1个棋子
    }
}
