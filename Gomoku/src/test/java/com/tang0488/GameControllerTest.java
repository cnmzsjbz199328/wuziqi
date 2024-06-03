package com.tang0488;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
public class GameControllerTest {

    @Mock
    private SimpMessagingTemplate template;

    @InjectMocks
    private GameController gameController;

    @Test
    public void testProcessMove() {
        GameMove move = new GameMove();
        move.setRow(1);
        move.setColumn(2);
        move.setPlayer("Player1");

        GameMove processedMove = gameController.processMove(move);

        assertEquals(move.getRow(), processedMove.getRow());
        assertEquals(move.getColumn(), processedMove.getColumn());
        assertEquals(move.getPlayer(), processedMove.getPlayer());

        verify(template).convertAndSend("/topic/gameState", processedMove);
    }
}
