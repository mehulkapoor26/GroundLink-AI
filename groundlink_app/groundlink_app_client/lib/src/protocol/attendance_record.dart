/* AUTOMATICALLY GENERATED CODE DO NOT MODIFY */
/*   To generate run: "serverpod generate"    */

// ignore_for_file: implementation_imports
// ignore_for_file: library_private_types_in_public_api
// ignore_for_file: non_constant_identifier_names
// ignore_for_file: public_member_api_docs
// ignore_for_file: type_literal_in_constant_pattern
// ignore_for_file: use_super_parameters
// ignore_for_file: invalid_use_of_internal_member

// ignore_for_file: no_leading_underscores_for_library_prefixes
import 'package:serverpod_client/serverpod_client.dart' as _isc;

abstract class AttendanceRecord
    implements _isc.SerializableModel, _isc.ProtocolSerialization {
  AttendanceRecord._({
    this.id,
    required this.sessionId,
    required this.memberName,
    required this.checkedInAt,
  });

  factory AttendanceRecord({
    int? id,
    required int sessionId,
    required String memberName,
    required DateTime checkedInAt,
  }) = _AttendanceRecordImpl;

  factory AttendanceRecord.fromJson(Map<String, dynamic> jsonSerialization) {
    return AttendanceRecord(
      id: jsonSerialization['id'] as int?,
      sessionId: jsonSerialization['sessionId'] as int,
      memberName: jsonSerialization['memberName'] as String,
      checkedInAt: _isc.DateTimeJsonExtension.fromJson(
        jsonSerialization['checkedInAt'],
      ),
    );
  }

  /// The database id, set if the object has been inserted into the
  /// database or if it has been fetched from the database. Otherwise,
  /// the id will be null.
  int? id;

  int sessionId;

  String memberName;

  DateTime checkedInAt;

  /// Returns a shallow copy of this [AttendanceRecord]
  /// with some or all fields replaced by the given arguments.
  @_isc.useResult
  AttendanceRecord copyWith({
    int? id,
    int? sessionId,
    String? memberName,
    DateTime? checkedInAt,
  });
  @override
  Map<String, dynamic> toJson() {
    return {
      '__className__': 'AttendanceRecord',
      if (id != null) 'id': id,
      'sessionId': sessionId,
      'memberName': memberName,
      'checkedInAt': checkedInAt.toJson(),
    };
  }

  @override
  Map<String, dynamic> toJsonForProtocol() {
    return {
      '__className__': 'AttendanceRecord',
      if (id != null) 'id': id,
      'sessionId': sessionId,
      'memberName': memberName,
      'checkedInAt': checkedInAt.toJson(),
    };
  }

  @override
  String toString() {
    return _isc.SerializationManager.encode(this);
  }
}

class _Undefined {}

class _AttendanceRecordImpl extends AttendanceRecord {
  _AttendanceRecordImpl({
    int? id,
    required int sessionId,
    required String memberName,
    required DateTime checkedInAt,
  }) : super._(
         id: id,
         sessionId: sessionId,
         memberName: memberName,
         checkedInAt: checkedInAt,
       );

  /// Returns a shallow copy of this [AttendanceRecord]
  /// with some or all fields replaced by the given arguments.
  @_isc.useResult
  @override
  AttendanceRecord copyWith({
    Object? id = _Undefined,
    int? sessionId,
    String? memberName,
    DateTime? checkedInAt,
  }) {
    return AttendanceRecord(
      id: id is int? ? id : this.id,
      sessionId: sessionId ?? this.sessionId,
      memberName: memberName ?? this.memberName,
      checkedInAt: checkedInAt ?? this.checkedInAt,
    );
  }
}
