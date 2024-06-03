package com.tang0488;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class GameController {

	@Autowired
	private SimpMessagingTemplate template;

	public void processMove(GameMove move) {
		System.out.println("Processing move: row " + move.getRow() + ", column " + move.getColumn());
		template.convertAndSend("/topic/gameState", move);
	}
}

