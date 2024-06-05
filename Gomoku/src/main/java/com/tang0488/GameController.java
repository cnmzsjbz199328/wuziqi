package com.tang0488;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@Controller
@RequestMapping("/game")
public class GameController {

	private final Game game;


	@Autowired
	public GameController(Game game) {
		this.game = game;
	}

	@GetMapping
	public String getGame(Model model) {
		model.addAttribute("game", game);
		return "index";
	}
	@PostMapping("/move")
	@ResponseBody
	public Map<String, Object> processMove(@RequestBody Map<String, Integer> move) {
		int row = move.get("row");
		int col = move.get("col");
		Map<String, Object> response = new HashMap<>();
		boolean moveMade = game.makeMove(row, col);
		response.put("moveMade", moveMade);
		response.put("currentPlayer", game.getCurrentPlayer());
		response.put("board", game.getBoard().getBoard());
		if (moveMade) {
			if (game.checkWin(game.getCurrentPlayer())) { // 修正调用方法
				response.put("winner", game.getCurrentPlayer());
			} else {
				game.switchPlayer();
				game.getMoveStrategy().makeMove(game.getBoard(), game.getCurrentPlayer()); // 添加随机玩家移动
				response.put("board", game.getBoard().getBoard());
				if (game.checkWin(game.getCurrentPlayer())) { // 再次检查当前玩家是否胜利
					response.put("winner", game.getCurrentPlayer());
				} else {
					game.switchPlayer();
				}
			}
		}
		return response;
	}

	public static class MoveRequest {
		private int row;
		private int col;

		public int getRow() {
			return row;
		}

		public void setRow(int row) {
			this.row = row;
		}

		public int getCol() {
			return col;
		}

		public void setCol(int col) {
			this.col = col;
		}
	}
}
