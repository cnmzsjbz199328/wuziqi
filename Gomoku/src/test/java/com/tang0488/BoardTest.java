package com.tang0488;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class BoardTest {
    private Board board;

    @BeforeEach
    public void setUp() {
        board = new Board();
    }

    @Test
    public void testAddMove() {
        assertTrue(board.addMove(0, 0, "Player1"));
        assertFalse(board.addMove(0, 0, "Player2"));
    }

    @Test
    public void testHorizontalWin() {
        for (int col = 0; col < 5; col++) {
            board.addMove(0, col, "Player1");
        }
        assertTrue(board.checkWin("Player1"));
    }

    @Test
    public void testVerticalWin() {
        for (int row = 0; row < 5; row++) {
            board.addMove(row, 0, "Player1");
        }
        assertTrue(board.checkWin("Player1"));
    }

    @Test
    public void testDiagonalWin() {
        for (int i = 0; i < 5; i++) {
            board.addMove(i, i, "Player1");
        }
        assertTrue(board.checkWin("Player1"));
    }

    @Test
    public void testAntiDiagonalWin() {
        for (int i = 0; i < 5; i++) {
            board.addMove(4 - i, i, "Player1");
        }
        assertTrue(board.checkWin("Player1"));
    }
}
