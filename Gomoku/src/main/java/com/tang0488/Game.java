package com.tang0488;

import java.util.Random;
import java.util.Scanner;

public class Game {
    private Board board;
    private String currentPlayer;
    private Scanner scanner;
    private Random random;

    public Game() {
        board = new Board();
        currentPlayer = "Player1";
        scanner = new Scanner(System.in);
        random = new Random();
    }

    public void start() {
        System.out.println("Welcome to Gomoku!");
        printBoard();
        while (true) {
            if (currentPlayer.equals("Player1")) {
                System.out.println(currentPlayer + ", enter your move (row and column): ");
                int row = scanner.nextInt();
                int col = scanner.nextInt();
                if (makeMove(row, col)) {
                    printBoard();
                    if (board.checkWin(currentPlayer)) {
                        System.out.println(currentPlayer + " wins!");
                        break;
                    }
                    switchPlayer();
                } else {
                    System.out.println("Invalid move. Try again.");
                }
            } else {
                makeRandomMove();
                printBoard();
                if (board.checkWin(currentPlayer)) {
                    System.out.println(currentPlayer + " wins!");
                    break;
                }
                switchPlayer();
            }
        }
    }

    public boolean makeMove(int row, int col) {
        if (board.addMove(row, col, currentPlayer)) {
            System.out.println("Move made by " + currentPlayer + " at (" + row + ", " + col + ")");
            return true;
        }
        return false;
    }

    private void makeRandomMove() {
        int row, col;
        do {
            row = random.nextInt(15);
            col = random.nextInt(15);
        } while (!board.addMove(row, col, currentPlayer));
        System.out.println("Move made by " + currentPlayer + " at (" + row + ", " + col + ")");
    }

    private void switchPlayer() {
        currentPlayer = currentPlayer.equals("Player1") ? "Player2" : "Player1";
    }

    private void printBoard() {
        String[][] boardArray = board.getBoard();
        for (int i = 0; i < boardArray.length; i++) {
            for (int j = 0; j < boardArray[i].length; j++) {
                System.out.print((boardArray[i][j] == null ? "." : boardArray[i][j]) + " ");
            }
            System.out.println();
        }
    }
}
