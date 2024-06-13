package com.tang0488.Poem;

public class Poem {
    private String lines;


    public Poem(String lines) {
        this.lines = lines;
    }

    public String getLines() {
        return lines;
    }

    public void setLines(String lines) {
        this.lines = lines;
    }

    @Override
    public String toString() {
        return lines;  // 这将使 Poem 对象在打印时显示诗歌内容
    }
}

