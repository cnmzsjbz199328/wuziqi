package com.tang0488;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import java.util.Scanner;
import java.util.Stack;

@Component
public class Game {
    private Board board;
    private String currentPlayer;
    private Scanner scanner;
    private Stack<int[]> moveHistory;
    private MoveStrategy moveStrategy;

    @Autowired
    public Game(MoveStrategy moveStrategy) {
        this.board = new Board();
        this.currentPlayer = "Player1";
        this.scanner = new Scanner(System.in);
        this.moveHistory = new Stack<>();
        this.moveStrategy = moveStrategy;
    }

    public void start() {
        System.out.println("Welcome to Gomoku!");
        printBoard();
        while (true) {
            if (currentPlayer.equals("Player1")) {
                System.out.println(currentPlayer + ", enter your move (row and column) or 'u' to undo: ");
                String input = scanner.next();
                if (input.equals("u")) {
                    undoMove();
                } else {
                    int row = Integer.parseInt(input);
                    int col = scanner.nextInt();
                    if (makeMove(row, col)) {
                        printBoard();
                        if (board.checkWin(currentPlayer)) {
                            System.out.println(currentPlayer + " wins!");
                            board.clearWinningLine(currentPlayer);
                            printBoard();
                            switchPlayer();
                        }else{
                            switchPlayer();
                        }

                    } else {
                        System.out.println("Invalid move. Try again.");
                    }
                }
            } else {
                moveStrategy.makeMove(board, currentPlayer);
                printBoard();
                if (board.checkWin(currentPlayer)) {
                    System.out.println(currentPlayer + " wins!");
                    board.clearWinningLine(currentPlayer);
                    printBoard();
                    switchPlayer();
                }else{
                    switchPlayer();
                }

            }
        }
    }

    public boolean makeMove(int row, int col) {
        if (board.addMove(row, col, currentPlayer)) {
            System.out.println("Move made by " + currentPlayer + " at (" + row + ", " + col + ")");
            moveHistory.push(new int[]{row, col});
            return true;
        }
        return false;
    }

    public MoveStrategy getMoveStrategy() {
        return moveStrategy;
    }

    public String getCurrentPlayer() {
        return currentPlayer;
    }

    public boolean checkWin(String player) {
        return board.checkWin(player);
    }

    public void switchPlayer() {
        currentPlayer = currentPlayer.equals("Player1") ? "Player2" : "Player1";
    }

    private void printBoard() {
        String[][] boardArray = board.getBoard();
        System.out.print("   ");
        for (int col = 0; col < Board.SIZE; col++) {
            System.out.print(col + " ");
        }
        System.out.println();
        for (int row = 0; row < Board.SIZE; row++) {
            System.out.print(row + " ");
            if (row < 10) System.out.print(" ");
            for (int col = 0; col < Board.SIZE; col++) {
                // 更改显示字符，使用 "P" 表示 "Player1"，使用 "B" 表示 "Player2"
                System.out.print((boardArray[row][col] == null ? "." : (boardArray[row][col].equals("Player1") ? "P" : "B")) + " ");
            }
            System.out.println();
        }
    }

    private void undoMove() {
        if (!moveHistory.isEmpty()) {
            int[] lastMove = moveHistory.pop();
            board.removeMove(lastMove[0], lastMove[1]);
            switchPlayer();
            System.out.println("Undo last move by " + currentPlayer);
            printBoard();
        } else {
            System.out.println("No moves to undo.");
        }
    }

    public Board getBoard() {
        return board;
    }
}
