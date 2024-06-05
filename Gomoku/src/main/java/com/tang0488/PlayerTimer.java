package com.tang0488;

import org.springframework.stereotype.Component;

import java.util.Timer;
import java.util.TimerTask;

@Component
public class PlayerTimer {
    private Timer timer;
    private boolean moveMade;
    private Runnable onTimeout;

    public void setMoveMade(boolean moveMade) {
        this.moveMade = moveMade;
    }

    public boolean isMoveMade() {
        return moveMade;
    }

    public void setOnTimeout(Runnable onTimeout) {
        this.onTimeout = onTimeout;
    }

    public void startTimer(String currentPlayer) {
        stopTimer(); // 确保之前的计时器停止
        moveMade = false; // 重置标志
        timer = new Timer();
        timer.schedule(new TimerTask() {
            @Override
            public void run() {
                if (!moveMade && onTimeout != null) {
                    onTimeout.run();
                }
            }
        }, 3000); // 3秒倒计时
    }

    public void stopTimer() {
        if (timer != null) {
            timer.cancel();
        }
    }
}
