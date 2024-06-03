package com.tang0488;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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

        gameController.processMove(move);

        verify(template).convertAndSend(eq("/topic/gameState"), eq(move));
    }
}
