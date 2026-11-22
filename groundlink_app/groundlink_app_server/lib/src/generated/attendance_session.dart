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
import 'dart:async' as _ida;
import 'package:serverpod/serverpod.dart' as _is;

abstract class AttendanceSession
    implements _is.TableRow<int?>, _is.ProtocolSerialization {
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
      isActive: _is.BoolJsonExtension.fromJson(jsonSerialization['isActive']),
      createdAt: _is.DateTimeJsonExtension.fromJson(
        jsonSerialization['createdAt'],
      ),
      closedAt: jsonSerialization['closedAt'] == null
          ? null
          : _is.DateTimeJsonExtension.fromJson(jsonSerialization['closedAt']),
    );
  }

  static final t = AttendanceSessionTable();

  static const db = AttendanceSessionRepository._();

  @override
  int? id;

  int groupId;

  String sessionCode;

  String title;

  bool isActive;

  DateTime createdAt;

  DateTime? closedAt;

  @override
  _is.Table<int?> get table => t;

  /// Returns a shallow copy of this [AttendanceSession]
  /// with some or all fields replaced by the given arguments.
  @_is.useResult
  AttendanceSession copyWith({
    int? id,
    int? groupId,
    String? sessionCode,
    String? title,
    bool? isActive,
    DateTime? createdAt,
    DateTime? closedAt = const _is.$UndefinedDateTime(),
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

  static AttendanceSessionInclude include() {
    return AttendanceSessionInclude._();
  }

  static AttendanceSessionIncludeList includeList({
    _is.WhereExpressionBuilder<AttendanceSessionTable>? where,
    int? limit,
    int? offset,
    _is.OrderByBuilder<AttendanceSessionTable>? orderBy,
    _is.OrderByListBuilder<AttendanceSessionTable>? orderByList,
    AttendanceSessionInclude? include,
  }) {
    return AttendanceSessionIncludeList._(
      where: where,
      limit: limit,
      offset: offset,
      orderBy: orderBy?.call(AttendanceSession.t),
      orderByList: orderByList?.call(AttendanceSession.t),
      include: include,
    );
  }

  @override
  String toString() {
    return _is.SerializationManager.encode(this);
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
  @_is.useResult
  @override
  AttendanceSession copyWith({
    Object? id = _Undefined,
    int? groupId,
    String? sessionCode,
    String? title,
    bool? isActive,
    DateTime? createdAt,
    DateTime? closedAt = const _is.$UndefinedDateTime(),
  }) {
    return AttendanceSession(
      id: id is int? ? id : this.id,
      groupId: groupId ?? this.groupId,
      sessionCode: sessionCode ?? this.sessionCode,
      title: title ?? this.title,
      isActive: isActive ?? this.isActive,
      createdAt: createdAt ?? this.createdAt,
      closedAt: closedAt is _is.UndefinedSentinel ? this.closedAt : closedAt,
    );
  }
}

class AttendanceSessionUpdateTable
    extends _is.UpdateTable<AttendanceSessionTable> {
  AttendanceSessionUpdateTable(super.table);

  _is.ColumnValue<int, int> groupId(int value) => _is.ColumnValue(
    table.groupId,
    value,
  );

  _is.ColumnValue<String, String> sessionCode(String value) => _is.ColumnValue(
    table.sessionCode,
    value,
  );

  _is.ColumnValue<String, String> title(String value) => _is.ColumnValue(
    table.title,
    value,
  );

  _is.ColumnValue<bool, bool> isActive(bool value) => _is.ColumnValue(
    table.isActive,
    value,
  );

  _is.ColumnValue<DateTime, DateTime> createdAt(DateTime value) =>
      _is.ColumnValue(
        table.createdAt,
        value,
      );

  _is.ColumnValue<DateTime, DateTime> closedAt(DateTime? value) =>
      _is.ColumnValue(
        table.closedAt,
        value,
      );
}

class AttendanceSessionTable extends _is.Table<int?> {
  AttendanceSessionTable({super.tableRelation})
    : super(tableName: 'attendance_session') {
    updateTable = AttendanceSessionUpdateTable(this);
    groupId = _is.ColumnInt(
      'groupId',
      this,
    );
    sessionCode = _is.ColumnString(
      'sessionCode',
      this,
    );
    title = _is.ColumnString(
      'title',
      this,
    );
    isActive = _is.ColumnBool(
      'isActive',
      this,
    );
    createdAt = _is.ColumnDateTime(
      'createdAt',
      this,
    );
    closedAt = _is.ColumnDateTime(
      'closedAt',
      this,
    );
  }

  late final AttendanceSessionUpdateTable updateTable;

  late final _is.ColumnInt groupId;

  late final _is.ColumnString sessionCode;

  late final _is.ColumnString title;

  late final _is.ColumnBool isActive;

  late final _is.ColumnDateTime createdAt;

  late final _is.ColumnDateTime closedAt;

  @override
  List<_is.Column> get columns => [
    id,
    groupId,
    sessionCode,
    title,
    isActive,
    createdAt,
    closedAt,
  ];
}

class AttendanceSessionInclude extends _is.IncludeObject {
  AttendanceSessionInclude._();

  @override
  Map<String, _is.Include?> get includes => {};

  @override
  _is.Table<int?> get table => AttendanceSession.t;
}

class AttendanceSessionIncludeList extends _is.IncludeList {
  AttendanceSessionIncludeList._({
    _is.WhereExpressionBuilder<AttendanceSessionTable>? where,
    super.limit,
    super.offset,
    super.orderBy,
    super.orderByList,
    super.include,
  }) {
    super.where = where?.call(AttendanceSession.t);
  }

  @override
  Map<String, _is.Include?> get includes => include?.includes ?? {};

  @override
  _is.Table<int?> get table => AttendanceSession.t;
}

class AttendanceSessionRepository {
  const AttendanceSessionRepository._();

  /// Returns a list of [AttendanceSession]s matching the given query parameters.
  ///
  /// Use [where] to specify which items to include in the return value.
  /// If none is specified, all items will be returned.
  ///
  /// To specify the order of the items use [orderBy] or [orderByList]
  /// when sorting by multiple columns.
  ///
  /// The maximum number of items can be set by [limit]. If no limit is set,
  /// all items matching the query will be returned.
  ///
  /// [offset] defines how many items to skip, after which [limit] (or all)
  /// items are read from the database.
  ///
  /// ```dart
  /// var persons = await Persons.db.find(
  ///   session,
  ///   where: (t) => t.lastName.equals('Jones'),
  ///   orderBy: (t) => t.firstName,
  ///   limit: 100,
  /// );
  /// ```
  Future<List<AttendanceSession>> find(
    _is.DatabaseSession session, {
    _is.WhereExpressionBuilder<AttendanceSessionTable>? where,
    int? limit,
    int? offset,
    _is.OrderByBuilder<AttendanceSessionTable>? orderBy,
    _is.OrderByListBuilder<AttendanceSessionTable>? orderByList,
    _is.Transaction? transaction,
    _is.LockMode? lockMode,
    _is.LockBehavior? lockBehavior,
  }) async {
    return session.db.find<AttendanceSession>(
      where: where?.call(AttendanceSession.t),
      orderBy: orderBy?.call(AttendanceSession.t),
      orderByList: orderByList?.call(AttendanceSession.t),
      limit: limit,
      offset: offset,
      transaction: transaction,
      lockMode: lockMode,
      lockBehavior: lockBehavior,
    );
  }

  /// Emits [AttendanceSession]s matching the given query parameters every time the
  /// source tables are modified.
  ///
  /// Use [where] to specify which items to include in the return value.
  /// If none is specified, all items will be returned.
  ///
  /// To specify the order of the items use [orderBy] or [orderByList]
  /// when sorting by multiple columns.
  ///
  /// The maximum number of items can be set by [limit]. If no limit is set,
  /// all items matching the query will be returned.
  ///
  /// [offset] defines how many items to skip, after which [limit] (or all)
  /// items are read from the database.
  ///
  /// Use [throttle] to specify the minimum interval between queries. It can
  /// also be set to `null`, in which case the stream will only be throttled
  /// when its subscription is paused.
  ///
  /// Source tables are collected from the queried table, [where], [orderBy],
  /// [orderByList], and the [include] graph. [alsoTriggerOnTables] is added
  /// to that set. Pass [Table] instances such as `AttendanceSession.t`.
  ///
  /// Raw [Expression] SQL is not inspected. Tables referenced only in raw
  /// SQL must be passed via [alsoTriggerOnTables].
  ///
  /// The stream always reads committed state and never joins an ambient
  /// [Transaction]. Emissions for a write fire after that write commits.
  ///
  /// Currently only supported on SQLite. Calling this method on PostgreSQL
  /// throws an [UnsupportedError].
  ///
  /// ```dart
  /// var subscription = Persons.db.watch(
  ///   session,
  ///   where: (t) => t.lastName.equals('Jones'),
  ///   orderBy: (t) => t.firstName,
  ///   limit: 100,
  /// ).listen((persons) {
  ///   // Handle the latest matching rows.
  /// });
  /// ```
  _ida.Stream<List<AttendanceSession>> watch(
    _is.DatabaseSession session, {
    _is.WhereExpressionBuilder<AttendanceSessionTable>? where,
    int? limit,
    int? offset,
    _is.OrderByBuilder<AttendanceSessionTable>? orderBy,
    _is.OrderByListBuilder<AttendanceSessionTable>? orderByList,
    Duration? throttle = const Duration(milliseconds: 30),
    Iterable<_is.Table>? alsoTriggerOnTables,
  }) {
    return session.db.watch<AttendanceSession>(
      where: where?.call(AttendanceSession.t),
      orderBy: orderBy?.call(AttendanceSession.t),
      orderByList: orderByList?.call(AttendanceSession.t),
      limit: limit,
      offset: offset,
      throttle: throttle,
      alsoTriggerOnTables: alsoTriggerOnTables,
    );
  }

  /// Returns the first matching [AttendanceSession] matching the given query parameters.
  ///
  /// Use [where] to specify which items to include in the return value.
  /// If none is specified, all items will be returned.
  ///
  /// To specify the order use [orderBy] or [orderByList]
  /// when sorting by multiple columns.
  ///
  /// [offset] defines how many items to skip, after which the next one will be picked.
  ///
  /// ```dart
  /// var youngestPerson = await Persons.db.findFirstRow(
  ///   session,
  ///   where: (t) => t.lastName.equals('Jones'),
  ///   orderBy: (t) => t.age,
  /// );
  /// ```
  Future<AttendanceSession?> findFirstRow(
    _is.DatabaseSession session, {
    _is.WhereExpressionBuilder<AttendanceSessionTable>? where,
    int? offset,
    _is.OrderByBuilder<AttendanceSessionTable>? orderBy,
    _is.OrderByListBuilder<AttendanceSessionTable>? orderByList,
    _is.Transaction? transaction,
    _is.LockMode? lockMode,
    _is.LockBehavior? lockBehavior,
  }) async {
    return session.db.findFirstRow<AttendanceSession>(
      where: where?.call(AttendanceSession.t),
      orderBy: orderBy?.call(AttendanceSession.t),
      orderByList: orderByList?.call(AttendanceSession.t),
      offset: offset,
      transaction: transaction,
      lockMode: lockMode,
      lockBehavior: lockBehavior,
    );
  }

  /// Finds a single [AttendanceSession] by its [id] or null if no such row exists.
  Future<AttendanceSession?> findById(
    _is.DatabaseSession session,
    int id, {
    _is.Transaction? transaction,
    _is.LockMode? lockMode,
    _is.LockBehavior? lockBehavior,
  }) async {
    return session.db.findById<AttendanceSession>(
      id,
      transaction: transaction,
      lockMode: lockMode,
      lockBehavior: lockBehavior,
    );
  }

  /// Inserts all [AttendanceSession]s in the list and returns the inserted rows.
  ///
  /// The returned [AttendanceSession]s will have their `id` fields set.
  ///
  /// This is an atomic operation, meaning that if one of the rows fails to
  /// insert, none of the rows will be inserted.
  ///
  /// If [ignoreConflicts] is set to `true`, rows that conflict with existing
  /// rows are silently skipped, and only the successfully inserted rows are
  /// returned.
  ///
  /// If [noReturn] is set to `true`, the inserted rows are not read back from
  /// the database and an empty list is returned. This avoids the overhead of
  /// transferring and deserializing the rows when the result is not needed.
  Future<List<AttendanceSession>> insert(
    _is.DatabaseSession session,
    List<AttendanceSession> rows, {
    _is.Transaction? transaction,
    bool ignoreConflicts = false,
    bool noReturn = false,
  }) async {
    return session.db.insert<AttendanceSession>(
      rows,
      transaction: transaction,
      ignoreConflicts: ignoreConflicts,
      noReturn: noReturn,
    );
  }

  /// Inserts a single [AttendanceSession] and returns the inserted row.
  ///
  /// The returned [AttendanceSession] will have its `id` field set.
  Future<AttendanceSession> insertRow(
    _is.DatabaseSession session,
    AttendanceSession row, {
    _is.Transaction? transaction,
  }) async {
    return session.db.insertRow<AttendanceSession>(
      row,
      transaction: transaction,
    );
  }

  /// Upserts all [AttendanceSession]s in the list and returns the resulting rows.
  ///
  /// If a row conflicts on the given [conflictColumns], the existing row is
  /// updated with the new values. Otherwise, a new row is inserted.
  ///
  /// If [updateColumns] is provided, only those columns will be updated on
  /// conflict. If null, all non-conflict, non-id columns are updated.
  ///
  /// If [updateWhere] is provided, the update only applies to rows matching the
  /// given expression. Conflicting rows that don't match are skipped and not
  /// returned, so the resulting list may be shorter than [rows].
  ///
  /// The returned [AttendanceSession]s will have their `id` fields set.
  ///
  /// This is an atomic operation, meaning that if one of the rows fails,
  /// none of the rows will be affected.
  ///
  /// If [noReturn] is set to `true`, the resulting rows are not read back from
  /// the database and an empty list is returned. This avoids the overhead of
  /// transferring and deserializing the rows when the result is not needed.
  Future<List<AttendanceSession>> upsert(
    _is.DatabaseSession session,
    List<AttendanceSession> rows, {
    required _is.ColumnSelections<AttendanceSessionTable> conflictColumns,
    _is.ColumnSelections<AttendanceSessionTable>? updateColumns,
    _is.WhereExpressionBuilder<AttendanceSessionTable>? updateWhere,
    _is.Transaction? transaction,
    bool noReturn = false,
  }) async {
    return session.db.upsert<AttendanceSession>(
      rows,
      conflictColumns: conflictColumns(AttendanceSession.t),
      updateColumns: updateColumns?.call(AttendanceSession.t),
      updateWhere: updateWhere?.call(AttendanceSession.t),
      transaction: transaction,
      noReturn: noReturn,
    );
  }

  /// Upserts a single [AttendanceSession] and returns the resulting row.
  ///
  /// If the row conflicts on the given [conflictColumns], the existing row is
  /// updated. Otherwise, a new row is inserted.
  ///
  /// If [updateColumns] is provided, only those columns will be updated on
  /// conflict. If null, all non-conflict, non-id columns are updated.
  ///
  /// If [updateWhere] is provided, the update only applies when the existing
  /// row matches the expression. Returns `null` if no row was affected — for
  /// example when [updateWhere] does not match the conflicting row.
  ///
  /// The returned [AttendanceSession] will have its `id` field set.
  Future<AttendanceSession?> upsertRow(
    _is.DatabaseSession session,
    AttendanceSession row, {
    required _is.ColumnSelections<AttendanceSessionTable> conflictColumns,
    _is.ColumnSelections<AttendanceSessionTable>? updateColumns,
    _is.WhereExpressionBuilder<AttendanceSessionTable>? updateWhere,
    _is.Transaction? transaction,
  }) async {
    return session.db.upsertRow<AttendanceSession>(
      row,
      conflictColumns: conflictColumns(AttendanceSession.t),
      updateColumns: updateColumns?.call(AttendanceSession.t),
      updateWhere: updateWhere?.call(AttendanceSession.t),
      transaction: transaction,
    );
  }

  /// Updates all [AttendanceSession]s in the list and returns the updated rows. If
  /// [columns] is provided, only those columns will be updated. Defaults to
  /// all columns.
  /// This is an atomic operation, meaning that if one of the rows fails to
  /// update, none of the rows will be updated.
  ///
  /// If [noReturn] is set to `true`, the updated rows are not read back from
  /// the database and an empty list is returned. This avoids the overhead of
  /// transferring and deserializing the rows when the result is not needed.
  Future<List<AttendanceSession>> update(
    _is.DatabaseSession session,
    List<AttendanceSession> rows, {
    _is.ColumnSelections<AttendanceSessionTable>? columns,
    _is.Transaction? transaction,
    bool noReturn = false,
  }) async {
    return session.db.update<AttendanceSession>(
      rows,
      columns: columns?.call(AttendanceSession.t),
      transaction: transaction,
      noReturn: noReturn,
    );
  }

  /// Updates a single [AttendanceSession]. The row needs to have its id set.
  /// Optionally, a list of [columns] can be provided to only update those
  /// columns. Defaults to all columns.
  Future<AttendanceSession> updateRow(
    _is.DatabaseSession session,
    AttendanceSession row, {
    _is.ColumnSelections<AttendanceSessionTable>? columns,
    _is.Transaction? transaction,
  }) async {
    return session.db.updateRow<AttendanceSession>(
      row,
      columns: columns?.call(AttendanceSession.t),
      transaction: transaction,
    );
  }

  /// Updates a single [AttendanceSession] by its [id] with the specified [columnValues].
  /// Returns the updated row or null if no row with the given id exists.
  Future<AttendanceSession?> updateById(
    _is.DatabaseSession session,
    int id, {
    required _is.ColumnValueListBuilder<AttendanceSessionUpdateTable>
    columnValues,
    _is.Transaction? transaction,
  }) async {
    return session.db.updateById<AttendanceSession>(
      id,
      columnValues: columnValues(AttendanceSession.t.updateTable),
      transaction: transaction,
    );
  }

  /// Updates all [AttendanceSession]s matching the [where] expression with the specified [columnValues].
  /// Returns the list of updated rows.
  ///
  /// If [noReturn] is set to `true`, the updated rows are not read back from
  /// the database and an empty list is returned. This avoids the overhead of
  /// transferring and deserializing the rows when the result is not needed.
  Future<List<AttendanceSession>> updateWhere(
    _is.DatabaseSession session, {
    required _is.ColumnValueListBuilder<AttendanceSessionUpdateTable>
    columnValues,
    required _is.WhereExpressionBuilder<AttendanceSessionTable> where,
    int? limit,
    int? offset,
    _is.OrderByBuilder<AttendanceSessionTable>? orderBy,
    _is.OrderByListBuilder<AttendanceSessionTable>? orderByList,
    _is.Transaction? transaction,
    bool noReturn = false,
  }) async {
    return session.db.updateWhere<AttendanceSession>(
      columnValues: columnValues(AttendanceSession.t.updateTable),
      where: where(AttendanceSession.t),
      limit: limit,
      offset: offset,
      orderBy: orderBy?.call(AttendanceSession.t),
      orderByList: orderByList?.call(AttendanceSession.t),
      transaction: transaction,
      noReturn: noReturn,
    );
  }

  /// Deletes all [AttendanceSession]s in the list and returns the deleted rows.
  ///
  /// To specify the order of the returned rows use [orderBy] or [orderByList]
  /// when sorting by multiple columns.
  ///
  /// This is an atomic operation, meaning that if one of the rows fail to
  /// be deleted, none of the rows will be deleted.
  ///
  /// If [noReturn] is set to `true`, the deleted rows are not read back from
  /// the database and an empty list is returned. This avoids the overhead of
  /// transferring and deserializing the rows when the result is not needed.
  Future<List<AttendanceSession>> delete(
    _is.DatabaseSession session,
    List<AttendanceSession> rows, {
    _is.OrderByBuilder<AttendanceSessionTable>? orderBy,
    _is.OrderByListBuilder<AttendanceSessionTable>? orderByList,
    _is.Transaction? transaction,
    bool noReturn = false,
  }) async {
    return session.db.delete<AttendanceSession>(
      rows,
      orderBy: orderBy?.call(AttendanceSession.t),
      orderByList: orderByList?.call(AttendanceSession.t),
      transaction: transaction,
      noReturn: noReturn,
    );
  }

  /// Deletes a single [AttendanceSession].
  Future<AttendanceSession> deleteRow(
    _is.DatabaseSession session,
    AttendanceSession row, {
    _is.Transaction? transaction,
  }) async {
    return session.db.deleteRow<AttendanceSession>(
      row,
      transaction: transaction,
    );
  }

  /// Deletes all rows matching the [where] expression.
  ///
  /// To specify the order of the returned rows use [orderBy] or [orderByList]
  /// when sorting by multiple columns.
  ///
  /// If [noReturn] is set to `true`, the deleted rows are not read back from
  /// the database and an empty list is returned. This avoids the overhead of
  /// transferring and deserializing the rows when the result is not needed.
  Future<List<AttendanceSession>> deleteWhere(
    _is.DatabaseSession session, {
    required _is.WhereExpressionBuilder<AttendanceSessionTable> where,
    _is.OrderByBuilder<AttendanceSessionTable>? orderBy,
    _is.OrderByListBuilder<AttendanceSessionTable>? orderByList,
    _is.Transaction? transaction,
    bool noReturn = false,
  }) async {
    return session.db.deleteWhere<AttendanceSession>(
      where: where(AttendanceSession.t),
      orderBy: orderBy?.call(AttendanceSession.t),
      orderByList: orderByList?.call(AttendanceSession.t),
      transaction: transaction,
      noReturn: noReturn,
    );
  }

  /// Counts the number of rows matching the [where] expression. If omitted,
  /// will return the count of all rows in the table.
  Future<int> count(
    _is.DatabaseSession session, {
    _is.WhereExpressionBuilder<AttendanceSessionTable>? where,
    int? limit,
    _is.Transaction? transaction,
  }) async {
    return session.db.count<AttendanceSession>(
      where: where?.call(AttendanceSession.t),
      limit: limit,
      transaction: transaction,
    );
  }

  /// Acquires row-level locks on [AttendanceSession] rows matching the [where] expression.
  Future<void> lockRows(
    _is.DatabaseSession session, {
    required _is.WhereExpressionBuilder<AttendanceSessionTable> where,
    required _is.LockMode lockMode,
    required _is.Transaction transaction,
    _is.LockBehavior lockBehavior = _is.LockBehavior.wait,
  }) async {
    return session.db.lockRows<AttendanceSession>(
      where: where(AttendanceSession.t),
      lockMode: lockMode,
      lockBehavior: lockBehavior,
      transaction: transaction,
    );
  }
}
