package com.tang0488;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class GameTest {

    @Test
    public void testMakeMove() {
        Game game = new Game();
        game.makeMove(0, 0); // Player1
        game.makeMove(1, 0); // Player2
        game.makeMove(0, 1); // Player1
        game.makeMove(1, 1); // Player2
        game.makeMove(0, 2); // Player1
        game.makeMove(1, 2); // Player2
        game.makeMove(0, 3); // Player1
        game.makeMove(1, 3); // Player2
        game.makeMove(0, 4); // Player1

        assertTrue(game.getBoard().checkWin("Player1"));
    }
}
