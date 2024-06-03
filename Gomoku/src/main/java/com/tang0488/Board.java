package com.tang0488;

public class Board {
    private static final int SIZE = 15;
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

    public String[][] getBoard() {
        return board;
    }

    public boolean checkWin(String player) {
        return checkHorizontal(player);
    }

    private boolean checkHorizontal(String player) {
        for (int row = 0; row < SIZE; row++) {
            int count = 0;
            for (int col = 0; col < SIZE; col++) {
                if (board[row][col] != null && board[row][col].equals(player)) {
                    count++;
                    if (count == WIN_COUNT) {
                        return true;
                    }
                } else {
                    count = 0;
                }
            }
        }
        return false;
    }
}
