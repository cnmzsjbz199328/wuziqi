CREATE TABLE IF NOT EXISTS app_user (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    isAutomated BOOLEAN NOT NULL
);

INSERT INTO app_user (username, isAutomated) VALUES ('admin', FALSE);
INSERT INTO app_user (username, isAutomated) VALUES ('player1', FALSE);
INSERT INTO app_user (username, isAutomated) VALUES ('player2', TRUE);
