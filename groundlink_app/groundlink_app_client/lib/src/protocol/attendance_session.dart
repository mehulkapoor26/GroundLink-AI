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

abstract class AttendanceSession
    implements _isc.SerializableModel, _isc.ProtocolSerialization {
  AttendanceSession._({
    this.id,
    required this.groupId,
    required this.sessionCode,
    required this.title,
    required this.isActive,
    required this.createdAt,
    this.closedAt,
  });

  factory AttendanceSession({
    int? id,
    required int groupId,
    required String sessionCode,
    required String title,
    required bool isActive,
    required DateTime createdAt,
    DateTime? closedAt,
  }) = _AttendanceSessionImpl;

  factory AttendanceSession.fromJson(Map<String, dynamic> jsonSerialization) {
    return AttendanceSession(
      id: jsonSerialization['id'] as int?,
      groupId: jsonSerialization['groupId'] as int,
      sessionCode: jsonSerialization['sessionCode'] as String,
      title: jsonSerialization['title'] as String,
      isActive: _isc.BoolJsonExtension.fromJson(jsonSerialization['isActive']),
      createdAt: _isc.DateTimeJsonExtension.fromJson(
        jsonSerialization['createdAt'],
      ),
      closedAt: jsonSerialization['closedAt'] == null
          ? null
          : _isc.DateTimeJsonExtension.fromJson(jsonSerialization['closedAt']),
    );
  }

  /// The database id, set if the object has been inserted into the
  /// database or if it has been fetched from the database. Otherwise,
  /// the id will be null.
  int? id;

  int groupId;

  String sessionCode;

  String title;

  bool isActive;

  DateTime createdAt;

  DateTime? closedAt;

  /// Returns a shallow copy of this [AttendanceSession]
  /// with some or all fields replaced by the given arguments.
  @_isc.useResult
  AttendanceSession copyWith({
    int? id,
    int? groupId,
    String? sessionCode,
    String? title,
    bool? isActive,
    DateTime? createdAt,
    DateTime? closedAt = const _isc.$UndefinedDateTime(),
  });
  @override
  Map<String, dynamic> toJson() {
    return {
      '__className__': 'AttendanceSession',
      if (id != null) 'id': id,
      'groupId': groupId,
      'sessionCode': sessionCode,
      'title': title,
      'isActive': isActive,
      'createdAt': createdAt.toJson(),
      if (closedAt != null) 'closedAt': closedAt?.toJson(),
    };
  }

  @override
  Map<String, dynamic> toJsonForProtocol() {
    return {
      '__className__': 'AttendanceSession',
      if (id != null) 'id': id,
      'groupId': groupId,
      'sessionCode': sessionCode,
      'title': title,
      'isActive': isActive,
      'createdAt': createdAt.toJson(),
      if (closedAt != null) 'closedAt': closedAt?.toJson(),
    };
  }

  @override
  String toString() {
    return _isc.SerializationManager.encode(this);
  }
}

class _Undefined {}

class _AttendanceSessionImpl extends AttendanceSession {
  _AttendanceSessionImpl({
    int? id,
    required int groupId,
    required String sessionCode,
    required String title,
    required bool isActive,
    required DateTime createdAt,
    DateTime? closedAt,
  }) : super._(
         id: id,
         groupId: groupId,
         sessionCode: sessionCode,
         title: title,
         isActive: isActive,
         createdAt: createdAt,
         closedAt: closedAt,
       );

  /// Returns a shallow copy of this [AttendanceSession]
  /// with some or all fields replaced by the given arguments.
  @_isc.useResult
  @override
  AttendanceSession copyWith({
    Object? id = _Undefined,
    int? groupId,
    String? sessionCode,
    String? title,
    bool? isActive,
    DateTime? createdAt,
    DateTime? closedAt = const _isc.$UndefinedDateTime(),
  }) {
    return AttendanceSession(
      id: id is int? ? id : this.id,
      groupId: groupId ?? this.groupId,
      sessionCode: sessionCode ?? this.sessionCode,
      title: title ?? this.title,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      closedAt: closedAt is _isc.UndefinedSentinel ? this.closedAt : closedAt,
    );
  }
}
