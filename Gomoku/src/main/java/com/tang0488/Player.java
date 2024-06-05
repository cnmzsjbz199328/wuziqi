package com.tang0488;

public class Player {
    private String name;
    private boolean isAutomated;

    public Player(String name, boolean isAutomated) {
        this.name = name;
        this.isAutomated = isAutomated;
    }

    public String getName() {
        return name;
    }

    public boolean isAutomated() {
        return isAutomated;
    }
}
