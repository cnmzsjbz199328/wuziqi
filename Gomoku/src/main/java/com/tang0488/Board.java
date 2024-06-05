package com.tang0488;

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
                if (checkLine(player, i, j, 1, 0) || checkLine(player, i, j, 0, 1)
                        || checkLine(player, i, j, 1, 1) || checkLine(player, i, j, 1, -1)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean checkLine(String player, int startX, int startY, int stepX, int stepY) {
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
        return count == 5;
    }

    public void clearWinningLine(String player) {
        for (int i = 0; i < SIZE; i++) {
            for (int j = 0; j < SIZE; j++) {
                if (checkLine(player, i, j, 1, 0)) { // 水平
                    clearLine(player, i, j, 1, 0);
                }
                if (checkLine(player, i, j, 0, 1)) { // 垂直
                    clearLine(player, i, j, 0, 1);
                }
                if (checkLine(player, i, j, 1, 1)) { // 主对角线
                    clearLine(player, i, j, 1, 1);
                }
                if (checkLine(player, i, j, 1, -1)) { // 副对角线
                    clearLine(player, i, j, 1, -1);
                }
            }
        }
    }

    private void clearLine(String player, int startX, int startY, int stepX, int stepY) {
        for (int i = 0; ; i++) {
            int x = startX + i * stepX;
            int y = startY + i * stepY;
            if (x >= 0 && x < SIZE && y >= 0 && y < SIZE && player.equals(board[x][y])) {
                board[x][y] = null;
            } else {
                break;
            }
        }
    }

}
