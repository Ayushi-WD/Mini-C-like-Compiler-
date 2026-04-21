import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;
import java.awt.event.ActionEvent;


public class CompilerApp extends JFrame {

    private JTextArea inputArea;
    private JTextArea assemblyArea;
    private JLabel statusLabel;
    private JTextArea consoleArea;

    public CompilerApp() {
        setTitle("Mini C-like Compiler - GUI Edition");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setSize(1000, 700);
        setLocationRelativeTo(null);

        JPanel mainPanel = new JPanel(new BorderLayout(10, 10));
        mainPanel.setBorder(new EmptyBorder(10, 10, 10, 10));
        mainPanel.setBackground(new Color(30, 30, 30));

        JSplitPane splitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT);
        splitPane.setDividerLocation(500);
        splitPane.setResizeWeight(0.5);

        JPanel inputPanel = createEditorPanel("Input C-mini Expression", inputArea = new JTextArea());
        inputArea.setText("(5 + 3) * 2 / (4 - 1)");
        inputArea.setFont(new Font("Consolas", Font.PLAIN, 16));
        inputArea.setBackground(new Color(40, 44, 52));
        inputArea.setForeground(Color.WHITE);
        inputArea.setCaretColor(Color.WHITE);

        JPanel outputPanel = createEditorPanel("Generated x86 Assembly", assemblyArea = new JTextArea());
        assemblyArea.setEditable(false);
        assemblyArea.setFont(new Font("Consolas", Font.PLAIN, 16));
        assemblyArea.setBackground(new Color(33, 37, 43));
        assemblyArea.setForeground(new Color(171, 178, 191));

        splitPane.setLeftComponent(inputPanel);
        splitPane.setRightComponent(outputPanel);

        JPanel bottomPanel = new JPanel(new BorderLayout(5, 5));
        bottomPanel.setOpaque(false);

        consoleArea = new JTextArea(5, 20);
        consoleArea.setEditable(false);
        consoleArea.setBackground(Color.BLACK);
        consoleArea.setForeground(new Color(0, 255, 0));
        consoleArea.setFont(new Font("Monospaced", Font.PLAIN, 13));
        JScrollPane consoleScroll = new JScrollPane(consoleArea);
        consoleScroll.setBorder(BorderFactory.createTitledBorder(BorderFactory.createLineBorder(Color.GRAY), "Console Log", 0, 0, null, Color.WHITE));

        statusLabel = new JLabel("Ready");
        statusLabel.setForeground(Color.LIGHT_GRAY);

        bottomPanel.add(consoleScroll, BorderLayout.CENTER);
        bottomPanel.add(statusLabel, BorderLayout.SOUTH);

        JToolBar toolBar = new JToolBar();
        toolBar.setFloatable(false);
        toolBar.setBackground(new Color(45, 45, 45));

        JButton compileBtn = new JButton("Compile to ASM");
        styleButton(compileBtn, new Color(76, 175, 80));
        compileBtn.addActionListener(this::handleCompile);

        JButton runBtn = new JButton("Assemble & Run");
        styleButton(runBtn, new Color(33, 150, 243));
        runBtn.addActionListener(this::handleRun);

        JButton clearBtn = new JButton("Clear All");
        styleButton(clearBtn, new Color(244, 67, 54));
        clearBtn.addActionListener(e -> {
            inputArea.setText("");
            assemblyArea.setText("");
            consoleArea.setText("");
            statusLabel.setText("Cleared");
        });

        JButton loadFileBtn = new JButton("Load File");
        styleButton(loadFileBtn, new Color(156, 39, 176));
        loadFileBtn.addActionListener(e -> {
            JFileChooser fileChooser = new JFileChooser(new java.io.File("tests"));
            fileChooser.setDialogTitle("Select a C-mini test file");
            int resultOption = fileChooser.showOpenDialog(this);
            if (resultOption == JFileChooser.APPROVE_OPTION) {
                java.io.File selectedFile = fileChooser.getSelectedFile();
                try {
                    String content = java.nio.file.Files.readString(selectedFile.toPath());
                    inputArea.setText(content);
                    consoleArea.append("> Loaded file: " + selectedFile.getName() + "\n");
                    statusLabel.setText("File Loaded");
                } catch (Exception ex) {
                    consoleArea.append("! Error reading file: " + ex.getMessage() + "\n");
                    statusLabel.setText("Failed to load file");
                }
            }
        });

        toolBar.add(loadFileBtn);
        toolBar.add(Box.createHorizontalStrut(10));
        toolBar.add(compileBtn);
        toolBar.add(Box.createHorizontalStrut(10));
        toolBar.add(runBtn);
        toolBar.add(Box.createHorizontalStrut(10));
        toolBar.add(clearBtn);

        mainPanel.add(toolBar, BorderLayout.NORTH);
        mainPanel.add(splitPane, BorderLayout.CENTER);
        mainPanel.add(bottomPanel, BorderLayout.SOUTH);

        setContentPane(mainPanel);
    }

    private JPanel createEditorPanel(String title, JTextArea textArea) {
        JPanel p = new JPanel(new BorderLayout());
        p.setOpaque(false);
        JLabel label = new JLabel(title);
        label.setForeground(Color.WHITE);
        label.setBorder(new EmptyBorder(0, 0, 5, 0));
        p.add(label, BorderLayout.NORTH);
        JScrollPane scroll = new JScrollPane(textArea);
        scroll.setBorder(BorderFactory.createLineBorder(new Color(60, 60, 60)));
        p.add(scroll, BorderLayout.CENTER);
        return p;
    }

    private void styleButton(JButton btn, Color bg) {
        btn.setBackground(bg);
        btn.setForeground(Color.WHITE);
        btn.setFocusPainted(false);
        btn.setBorder(BorderFactory.createEmptyBorder(5, 15, 5, 15));
        btn.setFont(new Font("Segoe UI", Font.BOLD, 14));
    }

    private void handleRun(ActionEvent e) {
        handleCompile(null);
        if (assemblyArea.getText().isEmpty()) return;

        new Thread(() -> {
            try {
                updateStatus("Saving ASM...");
                java.nio.file.Path outputsDir = java.nio.file.Paths.get("outputs");
                if (!java.nio.file.Files.exists(outputsDir)) java.nio.file.Files.createDirectories(outputsDir);
                
                java.nio.file.Path asmPath = outputsDir.resolve("program.asm");
                java.nio.file.Files.writeString(asmPath, assemblyArea.getText());

                updateStatus("Assembling...");
                if (runCommand("nasm", "-f", "win64", "outputs/program.asm", "-o", "outputs/program.obj") != 0) return;
                
                updateStatus("Compiling Driver...");
                String gccPath = new java.io.File("C:\\mingw64\\bin\\gcc.exe").exists() ? "C:\\mingw64\\bin\\gcc.exe" : "gcc";
                if (runCommand(gccPath, "-c", "runtime/driver.c", "-o", "outputs/driver.obj") != 0) return;
                
                updateStatus("Linking...");
                if (runCommand(gccPath, "outputs/driver.obj", "outputs/program.obj", "-o", "outputs/program.exe") != 0) return;
                
                updateStatus("Executing...");
                String exePath = new java.io.File("outputs/program.exe").getAbsolutePath();
                runCommand(exePath);
                
                updateStatus("Done");
            } catch (Exception ex) {
                consoleArea.append("! Execution Error: " + ex.getMessage() + "\n");
                ex.printStackTrace();
                updateStatus("Run Failed");
            }
        }).start();
    }

    private int runCommand(String... args) throws Exception {
        consoleArea.append("> " + String.join(" ", args) + "\n");
        ProcessBuilder pb = new ProcessBuilder(args);
        pb.redirectErrorStream(true);
        Process p = pb.start();
        
        try (java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(p.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String finalLine = line;
                SwingUtilities.invokeLater(() -> consoleArea.append(finalLine + "\n"));
            }
        }
        int exitCode = p.waitFor();
        if (exitCode != 0) {
            SwingUtilities.invokeLater(() -> consoleArea.append("! Command failed with exit code: " + exitCode + "\n"));
        }
        return exitCode;
    }

    private void updateStatus(String text) {
        SwingUtilities.invokeLater(() -> statusLabel.setText(text));
    }

    private void handleCompile(ActionEvent e) {
        String input = inputArea.getText().trim();
        if (input.isEmpty()) {
            JOptionPane.showMessageDialog(this, "Please enter an expression.");
            return;
        }

        consoleArea.append("> Compiling expression: " + input + "\n");
        try {
            CompilerBackend backend = new CompilerBackend(input);
            String asm = backend.compile();
            assemblyArea.setText(asm);
            consoleArea.append("> Success: Result would be " + backend.getResult() + "\n");
            statusLabel.setText("Compilation Successful");
        } catch (Exception ex) {
            consoleArea.append("! Error: " + ex.getMessage() + "\n");
            statusLabel.setText("Compilation Failed");
        }
    }

    static class CompilerBackend {
        enum TokenType { NUMBER, PLUS, MINUS, STAR, SLASH, LPAREN, RPAREN, EOF }
        class Token {
            TokenType type;
            int value;
            Token(TokenType type) { this.type = type; }
            Token(TokenType type, int value) { this.type = type; this.value = value; }
        }

        private String input;
        private int pos = 0;
        private Token currentToken;
        private StringBuilder asm = new StringBuilder();
        private int result;

        public CompilerBackend(String input) {
            this.input = input;
            nextToken();
        }

        private void nextToken() {
            while (pos < input.length() && Character.isWhitespace(input.charAt(pos))) pos++;
            if (pos >= input.length()) {
                currentToken = new Token(TokenType.EOF);
                return;
            }

            char c = input.charAt(pos);
            if (Character.isDigit(c)) {
                StringBuilder sb = new StringBuilder();
                while (pos < input.length() && Character.isDigit(input.charAt(pos))) {
                    sb.append(input.charAt(pos++));
                }
                currentToken = new Token(TokenType.NUMBER, Integer.parseInt(sb.toString()));
                return;
            }

            pos++;
            switch (c) {
                case '+': currentToken = new Token(TokenType.PLUS); break;
                case '-': currentToken = new Token(TokenType.MINUS); break;
                case '*': currentToken = new Token(TokenType.STAR); break;
                case '/': currentToken = new Token(TokenType.SLASH); break;
                case '(': currentToken = new Token(TokenType.LPAREN); break;
                case ')': currentToken = new Token(TokenType.RPAREN); break;
                default: throw new RuntimeException("Unknown character: " + c);
            }
        }

        private void eat(TokenType type) {
            if (currentToken.type == type) nextToken();
            else throw new RuntimeException("Unexpected token: " + currentToken.type + ", expected: " + type);
        }

        public String compile() {
            asm.setLength(0);
            asm.append("section .text\n");
            asm.append("    global our_code\n\n");
            asm.append("our_code:\n");

            result = parseExpression();

            if (currentToken.type != TokenType.EOF) {
                throw new RuntimeException("Extra characters after expression");
            }

            asm.append("    ret\n");
            return asm.toString();
        }

        private int parseExpression() {
            int left = parseTerm();
            while (currentToken.type == TokenType.PLUS || currentToken.type == TokenType.MINUS) {
                TokenType op = currentToken.type;
                eat(op);
                asm.append("    push rax\n");
                int right = parseTerm();
                asm.append("    mov rbx, rax\n");
                asm.append("    pop rax\n");
                if (op == TokenType.PLUS) {
                    asm.append("    add rax, rbx\n");
                    left += right;
                } else {
                    asm.append("    sub rax, rbx\n");
                    left -= right;
                }
            }
            return left;
        }

        private int parseTerm() {
            int left = parseFactor();
            while (currentToken.type == TokenType.STAR || currentToken.type == TokenType.SLASH) {
                TokenType op = currentToken.type;
                eat(op);
                asm.append("    push rax\n");
                int right = parseFactor();
                asm.append("    mov rbx, rax\n");
                asm.append("    pop rax\n");
                if (op == TokenType.STAR) {
                    asm.append("    imul rax, rbx\n");
                    left *= right;
                } else {
                    asm.append("    xor rdx, rdx\n");
                    asm.append("    idiv rbx\n");
                    left /= right;
                }
            }
            return left;
        }

        private int parseFactor() {
            if (currentToken.type == TokenType.NUMBER) {
                int val = currentToken.value;
                asm.append("    mov rax, ").append(val).append("\n");
                eat(TokenType.NUMBER);
                return val;
            } else if (currentToken.type == TokenType.LPAREN) {
                eat(TokenType.LPAREN);
                int val = parseExpression();
                eat(TokenType.RPAREN);
                return val;
            }
            throw new RuntimeException("Expected number or '('");
        }

        public int getResult() { return result; }
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            try {
                UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
            } catch (Exception ignored) {}
            new CompilerApp().setVisible(true);
        });
    }
}
