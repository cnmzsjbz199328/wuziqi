package com.tang0488.Poem;

import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

@Service
public class PoemService {
    private List<Poem> poems;
    private Random random;

    public PoemService() {
        this.poems = new ArrayList<>();
        this.random = new Random();
        loadSamplePoems();
    }

    private void loadSamplePoems() {
        poems.add(new Poem("STRAY birds of summer come to my window to sing and fly away."));
        poems.add(new Poem("And yellow leaves of autumn, which have no songs, flutter and fall there with a sigh."));
        poems.add(new Poem("O TROUPE of little vagrants of the world, leave your footprints in my words."));
        poems.add(new Poem("THE world puts off its mask of vastness to its lover."));
        poems.add(new Poem("It becomes small as one song, as one kiss of the eternal."));
        poems.add(new Poem("IT is the tears of the earth that keep her smiles in bloom."));
        poems.add(new Poem("THE mighty desert is burning for the love of a blade of grass who shakes her head and laughs and flies away."));
        poems.add(new Poem("IF you shed tears when you miss the sun, you also miss the stars."));
        poems.add(new Poem("THE sands in your way beg for your song and your movement, dancing water. Will you carry the burden of their lameness?"));
        poems.add(new Poem("HER wistful face haunts my dreams like the rain at night."));


        // Add more poems as necessary
    }
    public String RandomWin() {

        return "哈哈，居然让我赢了！";
    }


    public Poem getRandomPoem() {
        int index = random.nextInt(poems.size());
        return poems.get(index);
    }
}
