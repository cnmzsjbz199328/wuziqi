package com.tang0488;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class UserTest {

    @Test
    public void testAddScore() {
        User user = new User("TestPlayer");
        user.setScore(0);  // 确保分数从0开始
        user.addScore(1);  // 增加1分
        assertEquals(1, user.getScore());  // 验证分数是否为1

        user.addScore(2);  // 再增加2分
        assertEquals(3, user.getScore());  // 验证分数是否累加到3
    }
}

