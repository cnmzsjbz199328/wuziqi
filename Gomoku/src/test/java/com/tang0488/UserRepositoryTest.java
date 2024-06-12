//package com.tang0488;
//
//import org.junit.jupiter.api.BeforeEach;
//import org.junit.jupiter.api.Test;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
//
//import static org.assertj.core.api.Assertions.assertThat;
//
//@DataJpaTest
//public class UserRepositoryTest {
//
//    @Autowired
//    private UserRepository userRepository;
//
//    @BeforeEach
//    void setUp() {
//        // 在测试初始化时插入用户数据
//        User user = new User();
//        user.setName("testuser");
//        user.setAutomated(false);
//        userRepository.save(user);
//    }
//
//    @Test
//    void testFindAll() {
//        assertThat(userRepository.findAll()).isNotEmpty();
//    }
//
//    @Test
//    void testFindByUsername() {
//        User user = userRepository.findByUsername("testuser");
//        assertThat(user).isNotNull();
//        assertThat(user.getName()).isEqualTo("testuser");
//    }
//}
