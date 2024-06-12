package com.tang0488;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@TestPropertySource(locations = "classpath:application-test.properties")
public class GameTest {

    @Autowired
    private Game game;

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    public void setUp() {
        userRepository.deleteAll();
        userRepository.save(new User("admin1", false));
        userRepository.save(new User("player12", false));
        userRepository.save(new User("player21", true));
    }

    @Test
    public void testInitializePlayers() {
        game.initializePlayers();
        List<User> players = game.getPlayers();
        assertNotNull(players);
        assertFalse(players.isEmpty());

        // 进一步检查每个玩家的数据是否正确
        assertEquals(3, players.size());

        User fixedPlayer = players.get(0);
        assertEquals("admin", fixedPlayer.getName());
        assertFalse(fixedPlayer.isAutomated());

        User player1 = players.get(1);
        assertEquals("player1", player1.getName());
        assertFalse(player1.isAutomated());

        User player2 = players.get(2);
        assertEquals("player2", player2.getName());
        assertTrue(player2.isAutomated());
    }
}
