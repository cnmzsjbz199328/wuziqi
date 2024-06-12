package com.tang0488;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

@Component
@Primary
public class SmartMoveStrategy implements MoveStrategy {

    private final RandomMoveStrategy randomMoveStrategy;

    @Autowired
    public SmartMoveStrategy(RandomMoveStrategy randomMoveStrategy) {
        this.randomMoveStrategy = randomMoveStrategy;
    }
    @Override
    public int[] makeMove(Board board, String currentPlayer) {
        int[] move = findBestMove(board, currentPlayer, 4);
        if (move != null) {
            return move;
        }
        move = findBestMove(board, currentPlayer, 3);
        if (move != null) {
            return move;
        }
        move = findBestMove(board, currentPlayer, 2);
        if (move != null) {
            return move;
        }
        move = findBestMove(board, currentPlayer, 1);
        if (move != null) {
            return move;
        }
        // 如果没有找到优先移动，使用随机移动
        return randomMoveStrategy.makeMove(board, currentPlayer);
    }

    private int[] findBestMove(Board board, String player, int priority) {
        for (int row = 0; row < Board.SIZE; row++) {
            for (int col = 0; col < Board.SIZE; col++) {
                if (board.addMove(row, col, player)) {
                    if (board.checkLine(player, row, col, 1, 0) == priority // 水平
                            || board.checkLine(player, row, col, 0, 1) == priority // 垂直
                            || board.checkLine(player, row, col, 1, 1) == priority // 主对角线
                            || board.checkLine(player, row, col, 1, -1) == priority) { // 副对角线
                        //board.removeMove(row, col); // 复原
                        return new int[]{row, col};
                    }
                    board.removeMove(row, col); // 复原
                }
            }
        }
        return null;
    }
}

