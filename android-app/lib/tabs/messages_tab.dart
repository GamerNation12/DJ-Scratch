import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:lucide_icons/lucide_icons.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'dart:developer';

class MessagesTab extends StatefulWidget {
  const MessagesTab({super.key});

  @override
  State<MessagesTab> createState() => _MessagesTabState();
}

class _MessagesTabState extends State<MessagesTab> {
  final storage = const FlutterSecureStorage();
  List<dynamic> _friends = [];
  Map<String, dynamic>? _activeChat;
  List<dynamic> _messages = [];
  final TextEditingController _msgController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  
  IO.Socket? _socket;
  String? _myId;
  String? _token;

  @override
  void initState() {
    super.initState();
    _initData();
  }

  Future<void> _initData() async {
    _token = await storage.read(key: 'token');
    if (_token == null) return;

    try {
      final parts = _token!.split('.');
      if (parts.length == 3) {
        final payload = utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
        final data = jsonDecode(payload);
        _myId = data['id'];
      }
    } catch (e) {
      log('Error parsing token: $e');
    }

    _fetchFriends();
    _connectSocket();
  }

  void _connectSocket() {
    if (_myId == null) return;
    
    // Replace with your actual deployed socket server IP if testing on real device
    _socket = IO.io('http://10.0.2.2:3001', IO.OptionBuilder()
      .setTransports(['websocket'])
      .disableAutoConnect()
      .build());

    _socket!.connect();

    _socket!.onConnect((_) {
      _socket!.emit('authenticate', _myId);
    });

    _socket!.on('receive_message', (data) {
      if (mounted) {
        setState(() {
          // Avoid duplicates
          if (!_messages.any((m) => m['id'] == data['id'])) {
            _messages.add(data);
            _scrollToBottom();
          }
        });
      }
    });
  }

  Future<void> _fetchFriends() async {
    if (_token == null) return;
    try {
      final res = await http.get(
        Uri.parse('https://dj-scratch.vercel.app/api/friends'),
        headers: {'Authorization': 'Bearer $_token'},
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (mounted) {
          setState(() {
            _friends = (data['friends'] as List).where((f) => f['status'] == 'accepted').toList();
          });
        }
      }
    } catch (e) {
      log('Fetch friends error: $e');
    }
  }

  Future<void> _fetchMessages(String friendId) async {
    if (_token == null) return;
    try {
      final res = await http.get(
        Uri.parse('https://dj-scratch.vercel.app/api/messages/$friendId'),
        headers: {'Authorization': 'Bearer $_token'},
      );
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (mounted) {
          setState(() {
            _messages = data['messages'] ?? [];
            _scrollToBottom();
          });
        }
      }
    } catch (e) {
      log('Fetch messages error: $e');
    }
  }

  Future<void> _sendMessage() async {
    if (_msgController.text.trim().isEmpty || _activeChat == null || _token == null) return;

    final content = _msgController.text.trim();
    _msgController.clear();

    try {
      final res = await http.post(
        Uri.parse('https://dj-scratch.vercel.app/api/messages/${_activeChat!['friend_id']}'),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'content': content}),
      );

      final data = jsonDecode(res.body);
      if (data['success'] == true && _socket != null) {
        setState(() {
          _messages.add(data['message']);
          _scrollToBottom();
        });
        _socket!.emit('new_message', data['message']);
      }
    } catch (e) {
      log('Send message error: $e');
    }
  }

  void _scrollToBottom() {
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _socket?.disconnect();
    _scrollController.dispose();
    _msgController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_activeChat == null) {
      return Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          title: Text('Messages', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
          backgroundColor: Colors.transparent,
          elevation: 0,
        ),
        body: _friends.isEmpty 
          ? const Center(child: Text('No friends yet. Add friends to chat!', style: TextStyle(color: Colors.white54)))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _friends.length,
              itemBuilder: (context, index) {
                final f = _friends[index];
                final name = f['display_name'] ?? f['friend_username'];
                return ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  leading: CircleAvatar(
                    backgroundColor: const Color(0xFF0AB5CD).withOpacity(0.2),
                    child: Text(name[0].toUpperCase(), style: const TextStyle(color: Color(0xFF0AB5CD), fontWeight: FontWeight.bold)),
                  ),
                  title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: Text('@${f['friend_username']}', style: const TextStyle(color: Colors.white54)),
                  onTap: () {
                    setState(() {
                      _activeChat = f;
                      _fetchMessages(f['friend_id']);
                    });
                  },
                );
              },
            ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft),
          onPressed: () => setState(() => _activeChat = null),
        ),
        title: Row(
          children: [
            CircleAvatar(
              radius: 16,
              backgroundColor: const Color(0xFF0AB5CD).withOpacity(0.2),
              child: Text((_activeChat!['display_name'] ?? _activeChat!['friend_username'])[0].toUpperCase(), style: const TextStyle(color: Color(0xFF0AB5CD), fontSize: 12, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(width: 8),
            Text(_activeChat!['display_name'] ?? _activeChat!['friend_username'], style: GoogleFonts.outfit(fontWeight: FontWeight.bold, fontSize: 18)),
          ],
        ),
        backgroundColor: Colors.black.withOpacity(0.5),
        elevation: 0,
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.all(16),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final m = _messages[index];
                final isMe = m['sender_id'] == _myId;
                return Align(
                  alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      color: isMe ? const Color(0xFF0AB5CD) : Colors.white.withOpacity(0.1),
                      borderRadius: BorderRadius.only(
                        topLeft: const Radius.circular(16),
                        topRight: const Radius.circular(16),
                        bottomLeft: Radius.circular(isMe ? 16 : 4),
                        bottomRight: Radius.circular(isMe ? 4 : 16),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                      children: [
                        Text(m['content'], style: const TextStyle(color: Colors.white, fontSize: 16)),
                        const SizedBox(height: 4),
                        Text(
                          DateTime.parse(m['sent_at']).toLocal().toString().substring(11, 16),
                          style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 10),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.5),
              border: Border(top: BorderSide(color: Colors.white.withOpacity(0.05))),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _msgController,
                    decoration: InputDecoration(
                      hintText: 'Message @${_activeChat!['friend_username']}...',
                      hintStyle: const TextStyle(color: Colors.white54),
                      filled: true,
                      fillColor: Colors.white.withOpacity(0.05),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    ),
                    onSubmitted: (_) => _sendMessage(),
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  decoration: const BoxDecoration(
                    color: Color(0xFF0AB5CD),
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    icon: const Icon(LucideIcons.send, color: Colors.white, size: 20),
                    onPressed: _sendMessage,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
