package com.tang0488;

import java.util.*;

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

    public int checkLine(String player, int startX, int startY, int stepX, int stepY) {
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

    public int clearWinningLine(String player) {
        Set<Point> toClear = new HashSet<>();  // Using a set to avoid duplicate removals

        // Check all possible lines from every board position
        for (int i = 0; i < SIZE; i++) {
            for (int j = 0; j < SIZE; j++) {
                collectClearableLines(player, i, j, 1, 0, toClear);  // Horizontal
                collectClearableLines(player, i, j, 0, 1, toClear);  // Vertical
                collectClearableLines(player, i, j, 1, 1, toClear);  // Main diagonal
                collectClearableLines(player, i, j, 1, -1, toClear); // Anti-diagonal
            }
        }

        // Remove all collected points and count them
        int totalRemoved = 0;
        for (Point p : toClear) {
            if (board[p.x][p.y] != null) {
                board[p.x][p.y] = null;
                totalRemoved++;
            }
        }

        // Optionally adjust opponent piece removal as needed
        if (totalRemoved > 0) {
            removeRandomOpponentPieces(player, totalRemoved);
        }

        return totalRemoved-4;  // You may adjust this return value based on your scoring rules
    }

    private void collectClearableLines(String player, int startX, int startY, int stepX, int stepY, Set<Point> toClear) {
        if (checkLine(player, startX, startY, stepX, stepY) >= WIN_COUNT) {
            for (int i = 0; i < WIN_COUNT; i++) {
                int x = startX + i * stepX;
                int y = startY + i * stepY;
                if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) {
                    toClear.add(new Point(x, y));
                }
            }
        }
    }

        private class Point {
            int x, y;

            Point(int x, int y) {
                this.x = x;
                this.y = y;
            }

            @Override
            public boolean equals(Object o) {
                if (this == o) return true;
                if (o == null || getClass() != o.getClass()) return false;
                Point point = (Point) o;
                return x == point.x && y == point.y;
            }

            @Override
            public int hashCode() {
                return Objects.hash(x, y);
            }
        }
    private void removeRandomOpponentPieces(String player, int count) {
        List<String> opponents = new ArrayList<>();
        // 获取所有非获胜玩家的名字
        for (int row = 0; row < SIZE; row++) {
            for (int col = 0; col < SIZE; col++) {
                String current = board[row][col];
                if (current != null && !current.equals(player) && !opponents.contains(current)) {
                    opponents.add(current);
                }
            }
        }

        Random random = new Random();
        // 遍历每个对手玩家
        for (String opponent : opponents) {
            List<int[]> opponentPieces = new ArrayList<>();
            for (int row = 0; row < SIZE; row++) {
                for (int col = 0; col < SIZE; col++) {
                    if (board[row][col] != null && board[row][col].equals(opponent)) {
                        opponentPieces.add(new int[]{row, col});
                    }
                }
            }

            for (int i = 0; i < count && !opponentPieces.isEmpty(); i++) {
                int[] piece = opponentPieces.remove(random.nextInt(opponentPieces.size()));
                board[piece[0]][piece[1]] = null;
            }
        }
    }
}
