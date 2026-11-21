import 'dart:math';
import 'package:serverpod/serverpod.dart';
import '../generated/protocol.dart';

class AttendanceEndpoint extends Endpoint {
  String _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    final rand = Random.secure();
    return List.generate(6, (_) => chars[rand.nextInt(chars.length)]).join();
  }

  Future<AttendanceSession> createSession(
    Session session,
    int groupId,
    String title,
  ) async {
    final row = AttendanceSession(
      groupId: groupId,
      sessionCode: _generateCode(),
      title: title.trim().isEmpty ? 'Team Check-In' : title.trim(),
      isActive: true,
      createdAt: DateTime.now().toUtc(),
    );
    return await AttendanceSession.db.insertRow(session, row);
  }

  Future<AttendanceRecord> checkIn(
    Session session,
    String sessionCode,
    String memberName,
  ) async {
    final cleanCode = sessionCode.trim().toUpperCase();
    final cleanName = memberName.trim();

    if (cleanCode.isEmpty || cleanName.isEmpty) {
      throw Exception('Session code and member name are required.');
    }

    final activeSession = await AttendanceSession.db.findFirstRow(
      session,
      where: (t) => t.sessionCode.equals(cleanCode) & t.isActive.equals(true),
    );

    if (activeSession == null || activeSession.id == null) {
      throw Exception('Invalid or closed attendance session.');
    }

    final existing = await AttendanceRecord.db.findFirstRow(
      session,
      where: (t) =>
          t.sessionId.equals(activeSession.id!) &
          t.memberName.equals(cleanName),
    );

    if (existing != null) {
      throw Exception('$cleanName is already checked in.');
    }

    final record = AttendanceRecord(
      sessionId: activeSession.id!,
      memberName: cleanName,
      checkedInAt: DateTime.now().toUtc(),
    );
    return await AttendanceRecord.db.insertRow(session, record);
  }

  Future<List<AttendanceRecord>> getAttendees(
    Session session,
    int sessionId,
  ) async {
    return await AttendanceRecord.db.find(
      session,
      where: (t) => t.sessionId.equals(sessionId),
      orderBy: (t) => t.checkedInAt,
    );
  }

  Future<AttendanceSession> closeSession(
    Session session,
    int sessionId,
  ) async {
    final existing = await AttendanceSession.db.findById(session, sessionId);
    if (existing == null) {
      throw Exception('Session not found.');
    }
    existing.isActive = false;
    existing.closedAt = DateTime.now().toUtc();
    return await AttendanceSession.db.updateRow(session, existing);
  }
}
