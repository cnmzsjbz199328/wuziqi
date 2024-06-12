package com.tang0488;

import jakarta.persistence.*;
//import lombok.Getter;

public class User {
    private Long id;
    private String username;
    private int score;
    //@Getter
    //@Getter


    public User(String username) {
        this.username = username;
        this.score = 0;
    }

    public User() {}

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return username;
    }

    public void setName(String name) {
        this.username = name;
    }

    public void setScore(int score) {
        this.score = score;
    }
    public int getScore() {
        return score;
    }

    public void addScore(int score) {
        this.score += score;
    }
}
