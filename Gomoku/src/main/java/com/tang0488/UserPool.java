package com.tang0488;

import org.springframework.stereotype.Component;
import java.util.ArrayList;
import java.util.List;

@Component
public class UserPool {
    private List<User> users;

    public UserPool() {
        users = new ArrayList<>();
        users.add(new User("G"));
    }

    public List<User> getUsers() {
        return users;
    }

    public void addUser(User user) {
        users.add(user);
    }
    public User findByUsername(String username) {
        for (User user : users) {
            if (user.getName().equals(username)) {
                return user;
            }
        }
        return null;
    }
}
