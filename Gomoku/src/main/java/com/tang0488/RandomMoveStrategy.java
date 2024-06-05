package com.tang0488;

import java.util.Random;
import org.springframework.stereotype.Component;

@Component
public class RandomMoveStrategy implements MoveStrategy {
    private Random random = new Random();

    @Override
    public int[] makeMove(Board board, String currentPlayer) {
        int row, col;
        do {
            row = random.nextInt(Board.SIZE);
            col = random.nextInt(Board.SIZE);
        } while (!board.addMove(row, col, currentPlayer));
        return new int[]{row, col};
    }
}
