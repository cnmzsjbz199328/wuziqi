package com.tang0488;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class GameController {

	@MessageMapping("/move")
	@SendTo("/topic/gameState")
	public GameMove processMove(GameMove move) {
		System.out.println("Processing move: row " + move.getRow() + ", column " + move.getColumn());
		return move;
	}
}
