package com.tang0488;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class GameMoveTest {
    @Test
    public void testGameMove() {
        GameMove move = new GameMove();
        move.setPlayer("player1");
        assertEquals("player1", move.getPlayer());
    }}
