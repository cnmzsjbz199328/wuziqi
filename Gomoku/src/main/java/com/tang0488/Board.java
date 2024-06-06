package com.tang0488;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

public class Board {
    public static final int SIZE = 15;
    private static final int WIN_COUNT = 5;
    private String[][] board;

    public Board() {
        board = new String[SIZE][SIZE];
    }

    public boolean addMove(int row, int col, String player) {
        if (row >= 0 && row < SIZE && col >= 0 && col < SIZE && board[row][col] == null) {
            board[row][col] = player;
            return true;
        }
        return false;
    }

    public void removeMove(int row, int col) {
        if (row >= 0 && row < SIZE && col >= 0 && col < SIZE) {
            board[row][col] = null;
        }
    }

    public String[][] getBoard() {
        return board;
    }

    public boolean checkWin(String player) {
        // 检查水平、垂直和对角线的五子连珠
        for (int i = 0; i < SIZE; i++) {
            for (int j = 0; j < SIZE; j++) {
                if (checkLine(player, i, j, 1, 0) > 4 || checkLine(player, i, j, 0, 1) > 4
                        || checkLine(player, i, j, 1, 1) > 4 || checkLine(player, i, j, 1, -1) > 4) {
                    return true;
                }
            }
        }
        return false;
    }

    private int checkLine(String player, int startX, int startY, int stepX, int stepY) {
        int count = 0;
        for (int i = 0; i < 5; i++) {
            int x = startX + i * stepX;
            int y = startY + i * stepY;
            if (x >= 0 && x < SIZE && y >= 0 && y < SIZE && player.equals(board[x][y])) {
                count++;
            } else {
                break;
            }
        }
        return count;
    }

    public void clearWinningLine(String player) {
        int totalRemoved = 0; // 用于记录被移除的棋子数量
        for (int i = 0; i < SIZE; i++) {
            for (int j = 0; j < SIZE; j++) {
                if (checkLine(player, i, j, 1, 0) >= WIN_COUNT) { // 水平
                    totalRemoved += clearLine(player, i, j, 1, 0);
                }
                if (checkLine(player, i, j, 0, 1) >= WIN_COUNT) { // 垂直
                    totalRemoved += clearLine(player, i, j, 0, 1);
                }
                if (checkLine(player, i, j, 1, 1) >= WIN_COUNT) { // 主对角线
                    totalRemoved += clearLine(player, i, j, 1, 1);
                }
                if (checkLine(player, i, j, 1, -1) >= WIN_COUNT) { // 副对角线
                    totalRemoved += clearLine(player, i, j, 1, -1);
                }
            }
        }
        if (totalRemoved > 0) {
            removeRandomOpponentPieces(player, totalRemoved); // 在所有行都清除完毕后移除对手棋子
        }
    }

    private int clearLine(String player, int startX, int startY, int stepX, int stepY) {
        int count =0;
        for (int i = 0; ; i++) {
            int x = startX + i * stepX;
            int y = startY + i * stepY;
            if (x >= 0 && x < SIZE && y >= 0 && y < SIZE && player.equals(board[x][y])) {
                board[x][y] = null;
                count++;
            } else {
                break;
            }
        }
        return count;
    }

    private void removeRandomOpponentPieces(String player, int count) {
        List<int[]> opponentPieces = new ArrayList<>();
        for (int row = 0; row < SIZE; row++) {
            for (int col = 0; col < SIZE; col++) {
                if (board[row][col] != null && !board[row][col].equals(player)) {
                    opponentPieces.add(new int[]{row, col});
                }
            }
        }
        Random random = new Random();
        for (int i = 0; i < count && !opponentPieces.isEmpty(); i++) {
            int[] piece = opponentPieces.remove(random.nextInt(opponentPieces.size()));
            board[piece[0]][piece[1]] = null;
        }
    }

}
