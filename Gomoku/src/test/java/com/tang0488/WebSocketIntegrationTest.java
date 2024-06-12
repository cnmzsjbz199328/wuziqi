//package com.tang0488;
//
//import static org.assertj.core.api.Assertions.assertThat;
//
//import static org.springframework.test.web.servlet.setup.MockMvcBuilders.webAppContextSetup;
//
//import org.junit.jupiter.api.BeforeEach;
//import org.junit.jupiter.api.Test;
//import org.junit.jupiter.api.extension.ExtendWith;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.boot.test.context.SpringBootTest;
//import org.springframework.context.ApplicationContext;
//import org.springframework.test.context.junit.jupiter.SpringExtension;
//import org.springframework.test.web.servlet.MockMvc;
//import org.springframework.web.context.WebApplicationContext;
//
//import java.util.concurrent.CountDownLatch;
//import java.util.concurrent.TimeUnit;
//
//import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
//import org.springframework.boot.test.web.server.LocalServerPort;
//import org.springframework.messaging.converter.StringMessageConverter;
//import org.springframework.messaging.simp.stomp.StompSession;
//import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
//import org.springframework.messaging.simp.stomp.StompSessionHandler;
//import org.springframework.messaging.simp.stomp.StompHeaders;
//import org.springframework.web.socket.WebSocketHttpHeaders;
//import org.springframework.web.socket.client.standard.StandardWebSocketClient;
//import org.springframework.web.socket.messaging.WebSocketStompClient;
//
//@ExtendWith(SpringExtension.class)
//@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
//@AutoConfigureMockMvc
//public class WebSocketIntegrationTest {
//
//    @Autowired
//    private WebApplicationContext webApplicationContext;
//
//    @LocalServerPort
//    private int port;
//
//    private MockMvc mockMvc;
//
//    private String WEBSOCKET_URI;
//
//    @BeforeEach
//    public void setup() {
//        this.mockMvc = webAppContextSetup(this.webApplicationContext).build();
//        this.WEBSOCKET_URI = "ws://localhost:" + port + "/websocket-endpoint";
//    }
//
//    @Test
//    public void testWebSocketConnection() throws Exception {
//        StandardWebSocketClient client = new StandardWebSocketClient();
//        WebSocketStompClient stompClient = new WebSocketStompClient(client);
//        stompClient.setMessageConverter(new StringMessageConverter());
//
//        final CountDownLatch latch = new CountDownLatch(1);
//
//        StompSessionHandler sessionHandler = new StompSessionHandlerAdapter() {
//            @Override
//            public void afterConnected(StompSession session, StompHeaders connectedHeaders) {
//                latch.countDown();
//            }
//        };
//
//        stompClient.connect(WEBSOCKET_URI, sessionHandler);
//
//        if (!latch.await(5, TimeUnit.SECONDS)) {
//            throw new AssertionError("Connection not established within time limit");
//        }
//    }
//
//    @Test
//    public void testSendMessage() throws Exception {
//        StandardWebSocketClient client = new StandardWebSocketClient();
//        WebSocketStompClient stompClient = new WebSocketStompClient(client);
//        stompClient.setMessageConverter(new StringMessageConverter());
//
//        final CountDownLatch latch = new CountDownLatch(1);
//        final String message = "test message";
//
//        StompSessionHandler sessionHandler = new StompSessionHandlerAdapter() {
//            @Override
//            public void afterConnected(StompSession session, StompHeaders connectedHeaders) {
//                session.send("/app/message", message);
//                latch.countDown();
//            }
//        };
//
//        StompSession session = stompClient.connect(WEBSOCKET_URI, sessionHandler).get();
//
//        if (!latch.await(5, TimeUnit.SECONDS)) {
//            throw new AssertionError("Message not sent within time limit");
//        }
//
//        assertThat(session.isConnected()).isTrue();
//    }
//}
