import 'package:flutter/material.dart';
import 'package:groundlink_app_client/groundlink_app_client.dart';
import 'package:qr_flutter/qr_flutter.dart';
class QrAttendanceScreen extends StatefulWidget {
  final Client client;

  const QrAttendanceScreen({super.key, required this.client});

  @override
  State<QrAttendanceScreen> createState() => _QrAttendanceScreenState();
}

class _QrAttendanceScreenState extends State<QrAttendanceScreen> {
  final _groupIdController = TextEditingController(text: '1');
  final _titleController = TextEditingController(text: 'Hackathon Sync');
  final _codeController = TextEditingController();
  final _nameController = TextEditingController();

  AttendanceSession? _activeSession;
  List<AttendanceRecord> _attendees = [];
  bool _isCreating = false;
  bool _isCheckingIn = false;
  bool _isLoadingAttendees = false;
  bool _isClosing = false;
  String? _statusMessage;
  bool _isError = false;

  @override
  void dispose() {
    _groupIdController.dispose();
    _titleController.dispose();
    _codeController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  String _cleanError(Object error) {
    return error.toString().replaceFirst(RegExp(r'^Exception:\s*'), '');
  }

  Future<void> _createSession() async {
    final groupId = int.tryParse(_groupIdController.text.trim());
    if (groupId == null) {
      setState(() {
        _statusMessage = 'Valid numeric Group ID daalo.';
        _isError = true;
      });
      return;
    }

    setState(() {
      _isCreating = true;
      _statusMessage = null;
      _isError = false;
    });

    try {
      final created = await widget.client.attendance.createSession(
        groupId,
        _titleController.text.trim(),
      );
      setState(() {
        _activeSession = created;
        _attendees = [];
        _codeController.text = created.sessionCode;
        _statusMessage = 'Session start ho gaya: ${created.sessionCode}';
        _isError = false;
      });
      if (created.id != null) {
        await _refreshAttendees(created.id!);
      }
    } catch (e) {
      setState(() {
        _statusMessage = _cleanError(e);
        _isError = true;
      });
    } finally {
      if (mounted) setState(() => _isCreating = false);
    }
  }

  Future<void> _refreshAttendees(int sessionId) async {
    setState(() => _isLoadingAttendees = true);
    try {
      final list = await widget.client.attendance.getAttendees(sessionId);
      if (mounted) {
        setState(() => _attendees = list);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _statusMessage = _cleanError(e);
          _isError = true;
        });
      }
    } finally {
      if (mounted) setState(() => _isLoadingAttendees = false);
    }
  }

  Future<void> _checkIn() async {
    setState(() {
      _isCheckingIn = true;
      _statusMessage = null;
      _isError = false;
    });

    try {
      final record = await widget.client.attendance.checkIn(
        _codeController.text.trim(),
        _nameController.text.trim(),
      );
      setState(() {
        _nameController.clear();
        _statusMessage = '${record.memberName} checked in!';
        _isError = false;
      });
      if (_activeSession?.id != null &&
          _activeSession!.id == record.sessionId) {
        await _refreshAttendees(_activeSession!.id!);
      }
    } catch (e) {
      setState(() {
        _statusMessage = _cleanError(e);
        _isError = true;
      });
    } finally {
      if (mounted) setState(() => _isCheckingIn = false);
    }
  }

  Future<void> _closeSession() async {
    final sessionId = _activeSession?.id;
    if (sessionId == null) return;

    setState(() {
      _isClosing = true;
      _statusMessage = null;
      _isError = false;
    });

    try {
      final closed = await widget.client.attendance.closeSession(sessionId);
      setState(() {
        _activeSession = closed;
        _statusMessage = 'Session closed.';
        _isError = false;
      });
    } catch (e) {
      setState(() {
        _statusMessage = _cleanError(e);
        _isError = true;
      });
    } finally {
      if (mounted) setState(() => _isClosing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = _activeSession;

    return Scaffold(
      appBar: AppBar(title: const Text('QR Attendance')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_statusMessage != null) ...[
              Card(
                color: _isError
                    ? Theme.of(context).colorScheme.errorContainer
                    : Theme.of(context).colorScheme.primaryContainer,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(_statusMessage!),
                ),
              ),
              const SizedBox(height: 12),
            ],
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Start Attendance Session',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _groupIdController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Group ID',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _titleController,
                      decoration: const InputDecoration(
                        labelText: 'Session Title',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: _isCreating ? null : _createSession,
                      child: Text(
                        _isCreating ? 'Creating...' : 'Create Session & QR',
                      ),
                    ),
                    if (session != null) ...[
                      const Divider(height: 28),
                      Text(
                        '${session.title} (${session.isActive ? "Active" : "Closed"})',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Code: ${session.sessionCode}',
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Center(
                        child: QrImageView(
                          data: session.sessionCode,
                          size: 180,
                          backgroundColor: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed:
                                  session.id == null || _isLoadingAttendees
                                      ? null
                                      : () => _refreshAttendees(session.id!),
                              child: Text(
                                _isLoadingAttendees
                                    ? 'Refreshing...'
                                    : 'Refresh (${_attendees.length})',
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: OutlinedButton(
                              onPressed: !session.isActive || _isClosing
                                  ? null
                                  : _closeSession,
                              child: Text(
                                _isClosing ? 'Closing...' : 'Close Session',
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'Checked-in Members',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 6),
                      if (_attendees.isEmpty)
                        const Text('Abhi koi check-in nahi hua hai.')
                      else
                        ..._attendees.map(
                          (item) => ListTile(
                            dense: true,
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.check_circle_outline),
                            title: Text(item.memberName),
                            subtitle: Text(
                              item.checkedInAt.toLocal().toString(),
                            ),
                          ),
                        ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Member Check-In',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _codeController,
                      textCapitalization: TextCapitalization.characters,
                      decoration: const InputDecoration(
                        labelText: 'Session Code',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _nameController,
                      decoration: const InputDecoration(
                        labelText: 'Member Name (e.g. Prachi, Rasam, Ronak, Ritika)',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: _isCheckingIn ? null : _checkIn,
                      child: Text(_isCheckingIn ? 'Checking in...' : 'Check In'),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
