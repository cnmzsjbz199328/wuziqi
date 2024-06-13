package com.tang0488;

import com.tang0488.Poem.Poem;
import com.tang0488.Poem.PoemService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.core.AbstractDestinationResolvingMessagingTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.stream.Collectors;
@RestController
@RequestMapping("/game")
public class GameController {

    private final Game game;
    private final RandomMoveStrategy randomMoveStrategy;
    private final SmartMoveStrategy smartMoveStrategy;
    private final UserPool userPool;
    private final SimpMessagingTemplate messagingTemplate;
    private PoemService poemService;
    @Autowired
    public GameController(Game game, RandomMoveStrategy randomMoveStrategy, SmartMoveStrategy smartMoveStrategy, UserPool userPool, SimpMessagingTemplate messagingTemplate, PoemService poemService) {
        this.game = game;
        this.randomMoveStrategy = randomMoveStrategy;
        this.smartMoveStrategy = smartMoveStrategy;
        this.userPool = userPool;
        this.messagingTemplate = messagingTemplate;
        this.poemService = poemService;
    }

    @GetMapping
    public String getGame(Model model) {
        model.addAttribute("game", game);
        return "index";
    }
    @GetMapping("/random-poem")
    public Poem getRandomPoem() {
        return poemService.getRandomPoem();
    }
    @GetMapping("/players")
    @ResponseBody
    public List<String> getPlayers() {
        return userPool.getUsers().stream()
                .map(User::getName)
                .collect(Collectors.toList());
    }

    @PostMapping("/move")
    @ResponseBody
    public Map<String, Object> processMove(@RequestBody Map<String, Integer> move) {
        int row = move.get("row");
        int col = move.get("col");
//        User currentUser = game.getCurrentPlayer(); // 获取当前用户
        Map<String, Object> response = new HashMap<>();
        boolean moveMade = game.makeMove(row, col);
        response.put("moveMade", moveMade);
        response.put("currentPlayer", game.getCurrentPlayer());
        response.put("board", game.getBoard().getBoard());
        if (moveMade) {
            if (game.checkWin(game.getCurrentPlayer())) { // 修正调用方法
                int scoreIncrement = game.getBoard().clearWinningLine(game.getCurrentPlayer());
                User currentUser = userPool.findByUsername(game.getCurrentPlayer());
                currentUser.addScore(scoreIncrement);
                response.put("winner", game.getCurrentPlayer());
                response.put("score", currentUser.getScore());  // 更新分数
                response.put("poem", poemService.getRandomPoem().getLines());// Send poem when player wins
            }
            game.nextPlayer();
            // 添加策略玩家的判断和执行策略
            if (game.getCurrentPlayer().equals("G")) {  // 假设策略玩家的用户名为"G"
                game.getMoveStrategy().makeMove(game.getBoard(), game.getCurrentPlayer());
                response.put("board", game.getBoard().getBoard());
                if (game.checkWin(game.getCurrentPlayer())) {
                    int scoreIncrement = game.getBoard().clearWinningLine(game.getCurrentPlayer());
                    User currentUser = userPool.findByUsername(game.getCurrentPlayer());
                    currentUser.addScore(scoreIncrement);
                    response.put("winner", game.getCurrentPlayer());
                    response.put("score", currentUser.getScore());
                    response.put("poem", poemService.RandomWin());  // Ensure this returns a Poem object with a content attribute
                }
                game.nextPlayer();
            }
        }
        response.put("users", userPool.getUsers()); // 修改点6：添加用户列表到响应
        return response;

    }
    @PostMapping("/strategy")
    @ResponseBody
    public void setStrategy(@RequestParam String strategy) {
        if ("random".equalsIgnoreCase(strategy)) {
            game.setMoveStrategy(randomMoveStrategy);
        } else if ("smart".equalsIgnoreCase(strategy)) {
            game.setMoveStrategy(smartMoveStrategy);
        }
    }

    @PostMapping("/register")
    @ResponseBody
    public Map<String, Object> registerPlayer(@RequestParam String username) {
        Map<String, Object> response = new HashMap<>();
        if (userPool.findByUsername(username) != null) {
            response.put("message", "Username already taken.");
        }else {
            User newUser = new User();
            newUser.setName(username);
            //game.initializePlayers();
            userPool.addUser(newUser);
            messagingTemplate.convertAndSend("/topic/users", userPool.getUsers());
            response.put("message", "Player registered successfully.");
        }
        response.put("users", userPool.getUsers()); // 修改点7：添加用户列表到响应
        return response;
    }

    @GetMapping("/users")
    @ResponseBody
    public List<User> getUsers() {
        return userPool.getUsers(); // 修改点8：返回用户列表
    }
}