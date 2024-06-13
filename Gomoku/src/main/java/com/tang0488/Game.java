package com.tang0488;

import com.tang0488.Poem.PoemService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import lombok.Getter;
import lombok.Setter;

import jakarta.annotation.PostConstruct;

import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;
import java.util.Stack;
@Getter
@Setter
@Component
public class Game {
    private final UserPool userPool;
    private Board board;
    private MoveStrategy moveStrategy;
    private Scanner scanner;
    private Stack<int[]> moveHistory;
    private List<User> players;
    private int currentPlayerIndex;
    private PoemService poemService;


    @Autowired
    public Game(UserPool userPool,RandomMoveStrategy randomMoveStrategy, SmartMoveStrategy smartMoveStrategy,PoemService poemService) {
        this.userPool = userPool;
        this.board = new Board();
        this.scanner = new Scanner(System.in);
        this.moveHistory = new Stack<>();
        this.moveStrategy = smartMoveStrategy; // 默认策略
        this.poemService = poemService;
        initializePlayers();
    }
    @PostConstruct
    public void initializePlayers() {
         this.players  = userPool.getUsers();
        if (players.isEmpty()) {
            throw new IllegalStateException("No users found in the repository.");
        }
        this.currentPlayerIndex = 0;
    }

    public void nextPlayer() {
        currentPlayerIndex = (currentPlayerIndex + 1) % players.size();
        getCurrentPlayer();
    }
    public void setMoveStrategy(MoveStrategy moveStrategy) {
        this.moveStrategy = moveStrategy;
    }

    public void start() {
        System.out.println("Welcome to Gomoku!");
        printBoard();
        while (true) {
            User currentPlayer = players.get(currentPlayerIndex);
            if (currentPlayerIndex == 0) {
                System.out.println(currentPlayer.getName() + ", enter your move (row and column) or 'u' to undo: ");
                String input = scanner.next();
                    int row = Integer.parseInt(input);
                    int col = scanner.nextInt();
                    if (makeMove(row, col)) {
                        printBoard();
                        if (board.checkWin(currentPlayer.getName())) {
                            int clearedCount = board.clearWinningLine(currentPlayer.getName());
                            currentPlayer.addScore(clearedCount);
                            System.out.println(currentPlayer.getName() + " Score: " + currentPlayer.getScore());
                            //board.clearWinningLine(currentPlayer.getName());
                            System.out.println(poemService.RandomWin());
                            printBoard();
                        }
                        nextPlayer();
                    } else {
                        System.out.println("Invalid move. Try again.");
                    }

            } else {
                moveStrategy.makeMove(board, currentPlayer.getName());
                printBoard();
                if (board.checkWin(currentPlayer.getName())) {
                    int clearedCount = board.clearWinningLine(currentPlayer.getName());
                    currentPlayer.addScore(clearedCount);
                    System.out.println(currentPlayer.getName() + " Score: " + currentPlayer.getScore());
                    System.out.println(poemService.RandomWin());
                    printBoard();
                }
                nextPlayer();
            }
        }
    }

    public boolean makeMove(int row, int col) {
        //User currentPlayer = players.get(currentPlayerIndex);
        if (board.addMove(row, col, getCurrentPlayer())) {
            System.out.println("Move made by " + getCurrentPlayer() + " at (" + row + ", " + col + ")");
            moveHistory.push(new int[]{row, col});
            return true;
        }
        return false;
    }
    public String getCurrentPlayer() {
        return players.get(currentPlayerIndex).getName();
    }

    public boolean checkWin(String player) {
        return board.checkWin(player);
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
                System.out.print((boardArray[row][col] == null ? "." : (boardArray[row][col].equals("Player1") ? "P" : "B")) + " ");
            }
            System.out.println();
        }
    }
}
