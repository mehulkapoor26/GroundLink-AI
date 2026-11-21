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

abstract class AttendanceRecord
    implements _is.TableRow<int?>, _is.ProtocolSerialization {
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
      checkedInAt: _is.DateTimeJsonExtension.fromJson(
        jsonSerialization['checkedInAt'],
      ),
    );
  }

  static final t = AttendanceRecordTable();

  static const db = AttendanceRecordRepository._();

  @override
  int? id;

  int sessionId;

  String memberName;

  DateTime checkedInAt;

  @override
  _is.Table<int?> get table => t;

  /// Returns a shallow copy of this [AttendanceRecord]
  /// with some or all fields replaced by the given arguments.
  @_is.useResult
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

  static AttendanceRecordInclude include() {
    return AttendanceRecordInclude._();
  }

  static AttendanceRecordIncludeList includeList({
    _is.WhereExpressionBuilder<AttendanceRecordTable>? where,
    int? limit,
    int? offset,
    _is.OrderByBuilder<AttendanceRecordTable>? orderBy,
    _is.OrderByListBuilder<AttendanceRecordTable>? orderByList,
    AttendanceRecordInclude? include,
  }) {
    return AttendanceRecordIncludeList._(
      where: where,
      limit: limit,
      offset: offset,
      orderBy: orderBy?.call(AttendanceRecord.t),
      orderByList: orderByList?.call(AttendanceRecord.t),
      include: include,
    );
  }

  @override
  String toString() {
    return _is.SerializationManager.encode(this);
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
  @_is.useResult
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

class AttendanceRecordUpdateTable
    extends _is.UpdateTable<AttendanceRecordTable> {
  AttendanceRecordUpdateTable(super.table);

  _is.ColumnValue<int, int> sessionId(int value) => _is.ColumnValue(
    table.sessionId,
    value,
  );

  _is.ColumnValue<String, String> memberName(String value) => _is.ColumnValue(
    table.memberName,
    value,
  );

  _is.ColumnValue<DateTime, DateTime> checkedInAt(DateTime value) =>
      _is.ColumnValue(
        table.checkedInAt,
        value,
      );
}

class AttendanceRecordTable extends _is.Table<int?> {
  AttendanceRecordTable({super.tableRelation})
    : super(tableName: 'attendance_record') {
    updateTable = AttendanceRecordUpdateTable(this);
    sessionId = _is.ColumnInt(
      'sessionId',
      this,
    );
    memberName = _is.ColumnString(
      'memberName',
      this,
    );
    checkedInAt = _is.ColumnDateTime(
      'checkedInAt',
      this,
    );
  }

  late final AttendanceRecordUpdateTable updateTable;

  late final _is.ColumnInt sessionId;

  late final _is.ColumnString memberName;

  late final _is.ColumnDateTime checkedInAt;

  @override
  List<_is.Column> get columns => [
    id,
    sessionId,
    memberName,
    checkedInAt,
  ];
}

class AttendanceRecordInclude extends _is.IncludeObject {
  AttendanceRecordInclude._();

  @override
  Map<String, _is.Include?> get includes => {};

  @override
  _is.Table<int?> get table => AttendanceRecord.t;
}

class AttendanceRecordIncludeList extends _is.IncludeList {
  AttendanceRecordIncludeList._({
    _is.WhereExpressionBuilder<AttendanceRecordTable>? where,
    super.limit,
    super.offset,
    super.orderBy,
    super.orderByList,
    super.include,
  }) {
    super.where = where?.call(AttendanceRecord.t);
  }

  @override
  Map<String, _is.Include?> get includes => include?.includes ?? {};

  @override
  _is.Table<int?> get table => AttendanceRecord.t;
}

class AttendanceRecordRepository {
  const AttendanceRecordRepository._();

  /// Returns a list of [AttendanceRecord]s matching the given query parameters.
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
  Future<List<AttendanceRecord>> find(
    _is.DatabaseSession session, {
    _is.WhereExpressionBuilder<AttendanceRecordTable>? where,
    int? limit,
    int? offset,
    _is.OrderByBuilder<AttendanceRecordTable>? orderBy,
    _is.OrderByListBuilder<AttendanceRecordTable>? orderByList,
    _is.Transaction? transaction,
    _is.LockMode? lockMode,
    _is.LockBehavior? lockBehavior,
  }) async {
    return session.db.find<AttendanceRecord>(
      where: where?.call(AttendanceRecord.t),
      orderBy: orderBy?.call(AttendanceRecord.t),
      orderByList: orderByList?.call(AttendanceRecord.t),
      limit: limit,
      offset: offset,
      transaction: transaction,
      lockMode: lockMode,
      lockBehavior: lockBehavior,
    );
  }

  /// Emits [AttendanceRecord]s matching the given query parameters every time the
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
  /// to that set. Pass [Table] instances such as `AttendanceRecord.t`.
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
  _ida.Stream<List<AttendanceRecord>> watch(
    _is.DatabaseSession session, {
    _is.WhereExpressionBuilder<AttendanceRecordTable>? where,
    int? limit,
    int? offset,
    _is.OrderByBuilder<AttendanceRecordTable>? orderBy,
    _is.OrderByListBuilder<AttendanceRecordTable>? orderByList,
    Duration? throttle = const Duration(milliseconds: 30),
    Iterable<_is.Table>? alsoTriggerOnTables,
  }) {
    return session.db.watch<AttendanceRecord>(
      where: where?.call(AttendanceRecord.t),
      orderBy: orderBy?.call(AttendanceRecord.t),
      orderByList: orderByList?.call(AttendanceRecord.t),
      limit: limit,
      offset: offset,
      throttle: throttle,
      alsoTriggerOnTables: alsoTriggerOnTables,
    );
  }

  /// Returns the first matching [AttendanceRecord] matching the given query parameters.
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
  Future<AttendanceRecord?> findFirstRow(
    _is.DatabaseSession session, {
    _is.WhereExpressionBuilder<AttendanceRecordTable>? where,
    int? offset,
    _is.OrderByBuilder<AttendanceRecordTable>? orderBy,
    _is.OrderByListBuilder<AttendanceRecordTable>? orderByList,
    _is.Transaction? transaction,
    _is.LockMode? lockMode,
    _is.LockBehavior? lockBehavior,
  }) async {
    return session.db.findFirstRow<AttendanceRecord>(
      where: where?.call(AttendanceRecord.t),
      orderBy: orderBy?.call(AttendanceRecord.t),
      orderByList: orderByList?.call(AttendanceRecord.t),
      offset: offset,
      transaction: transaction,
      lockMode: lockMode,
      lockBehavior: lockBehavior,
    );
  }

  /// Finds a single [AttendanceRecord] by its [id] or null if no such row exists.
  Future<AttendanceRecord?> findById(
    _is.DatabaseSession session,
    int id, {
    _is.Transaction? transaction,
    _is.LockMode? lockMode,
    _is.LockBehavior? lockBehavior,
  }) async {
    return session.db.findById<AttendanceRecord>(
      id,
      transaction: transaction,
      lockMode: lockMode,
      lockBehavior: lockBehavior,
    );
  }

  /// Inserts all [AttendanceRecord]s in the list and returns the inserted rows.
  ///
  /// The returned [AttendanceRecord]s will have their `id` fields set.
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
  Future<List<AttendanceRecord>> insert(
    _is.DatabaseSession session,
    List<AttendanceRecord> rows, {
    _is.Transaction? transaction,
    bool ignoreConflicts = false,
    bool noReturn = false,
  }) async {
    return session.db.insert<AttendanceRecord>(
      rows,
      transaction: transaction,
      ignoreConflicts: ignoreConflicts,
      noReturn: noReturn,
    );
  }

  /// Inserts a single [AttendanceRecord] and returns the inserted row.
  ///
  /// The returned [AttendanceRecord] will have its `id` field set.
  Future<AttendanceRecord> insertRow(
    _is.DatabaseSession session,
    AttendanceRecord row, {
    _is.Transaction? transaction,
  }) async {
    return session.db.insertRow<AttendanceRecord>(
      row,
      transaction: transaction,
    );
  }

  /// Upserts all [AttendanceRecord]s in the list and returns the resulting rows.
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
  /// The returned [AttendanceRecord]s will have their `id` fields set.
  ///
  /// This is an atomic operation, meaning that if one of the rows fails,
  /// none of the rows will be affected.
  ///
  /// If [noReturn] is set to `true`, the resulting rows are not read back from
  /// the database and an empty list is returned. This avoids the overhead of
  /// transferring and deserializing the rows when the result is not needed.
  Future<List<AttendanceRecord>> upsert(
    _is.DatabaseSession session,
    List<AttendanceRecord> rows, {
    required _is.ColumnSelections<AttendanceRecordTable> conflictColumns,
    _is.ColumnSelections<AttendanceRecordTable>? updateColumns,
    _is.WhereExpressionBuilder<AttendanceRecordTable>? updateWhere,
    _is.Transaction? transaction,
    bool noReturn = false,
  }) async {
    return session.db.upsert<AttendanceRecord>(
      rows,
      conflictColumns: conflictColumns(AttendanceRecord.t),
      updateColumns: updateColumns?.call(AttendanceRecord.t),
      updateWhere: updateWhere?.call(AttendanceRecord.t),
      transaction: transaction,
      noReturn: noReturn,
    );
  }

  /// Upserts a single [AttendanceRecord] and returns the resulting row.
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
  /// The returned [AttendanceRecord] will have its `id` field set.
  Future<AttendanceRecord?> upsertRow(
    _is.DatabaseSession session,
    AttendanceRecord row, {
    required _is.ColumnSelections<AttendanceRecordTable> conflictColumns,
    _is.ColumnSelections<AttendanceRecordTable>? updateColumns,
    _is.WhereExpressionBuilder<AttendanceRecordTable>? updateWhere,
    _is.Transaction? transaction,
  }) async {
    return session.db.upsertRow<AttendanceRecord>(
      row,
      conflictColumns: conflictColumns(AttendanceRecord.t),
      updateColumns: updateColumns?.call(AttendanceRecord.t),
      updateWhere: updateWhere?.call(AttendanceRecord.t),
      transaction: transaction,
    );
  }

  /// Updates all [AttendanceRecord]s in the list and returns the updated rows. If
  /// [columns] is provided, only those columns will be updated. Defaults to
  /// all columns.
  /// This is an atomic operation, meaning that if one of the rows fails to
  /// update, none of the rows will be updated.
  ///
  /// If [noReturn] is set to `true`, the updated rows are not read back from
  /// the database and an empty list is returned. This avoids the overhead of
  /// transferring and deserializing the rows when the result is not needed.
  Future<List<AttendanceRecord>> update(
    _is.DatabaseSession session,
    List<AttendanceRecord> rows, {
    _is.ColumnSelections<AttendanceRecordTable>? columns,
    _is.Transaction? transaction,
    bool noReturn = false,
  }) async {
    return session.db.update<AttendanceRecord>(
      rows,
      columns: columns?.call(AttendanceRecord.t),
      transaction: transaction,
      noReturn: noReturn,
    );
  }

  /// Updates a single [AttendanceRecord]. The row needs to have its id set.
  /// Optionally, a list of [columns] can be provided to only update those
  /// columns. Defaults to all columns.
  Future<AttendanceRecord> updateRow(
    _is.DatabaseSession session,
    AttendanceRecord row, {
    _is.ColumnSelections<AttendanceRecordTable>? columns,
    _is.Transaction? transaction,
  }) async {
    return session.db.updateRow<AttendanceRecord>(
      row,
      columns: columns?.call(AttendanceRecord.t),
      transaction: transaction,
    );
  }

  /// Updates a single [AttendanceRecord] by its [id] with the specified [columnValues].
  /// Returns the updated row or null if no row with the given id exists.
  Future<AttendanceRecord?> updateById(
    _is.DatabaseSession session,
    int id, {
    required _is.ColumnValueListBuilder<AttendanceRecordUpdateTable>
    columnValues,
    _is.Transaction? transaction,
  }) async {
    return session.db.updateById<AttendanceRecord>(
      id,
      columnValues: columnValues(AttendanceRecord.t.updateTable),
      transaction: transaction,
    );
  }

  /// Updates all [AttendanceRecord]s matching the [where] expression with the specified [columnValues].
  /// Returns the list of updated rows.
  ///
  /// If [noReturn] is set to `true`, the updated rows are not read back from
  /// the database and an empty list is returned. This avoids the overhead of
  /// transferring and deserializing the rows when the result is not needed.
  Future<List<AttendanceRecord>> updateWhere(
    _is.DatabaseSession session, {
    required _is.ColumnValueListBuilder<AttendanceRecordUpdateTable>
    columnValues,
    required _is.WhereExpressionBuilder<AttendanceRecordTable> where,
    int? limit,
    int? offset,
    _is.OrderByBuilder<AttendanceRecordTable>? orderBy,
    _is.OrderByListBuilder<AttendanceRecordTable>? orderByList,
    _is.Transaction? transaction,
    bool noReturn = false,
  }) async {
    return session.db.updateWhere<AttendanceRecord>(
      columnValues: columnValues(AttendanceRecord.t.updateTable),
      where: where(AttendanceRecord.t),
      limit: limit,
      offset: offset,
      orderBy: orderBy?.call(AttendanceRecord.t),
      orderByList: orderByList?.call(AttendanceRecord.t),
      transaction: transaction,
      noReturn: noReturn,
    );
  }

  /// Deletes all [AttendanceRecord]s in the list and returns the deleted rows.
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
  Future<List<AttendanceRecord>> delete(
    _is.DatabaseSession session,
    List<AttendanceRecord> rows, {
    _is.OrderByBuilder<AttendanceRecordTable>? orderBy,
    _is.OrderByListBuilder<AttendanceRecordTable>? orderByList,
    _is.Transaction? transaction,
    bool noReturn = false,
  }) async {
    return session.db.delete<AttendanceRecord>(
      rows,
      orderBy: orderBy?.call(AttendanceRecord.t),
      orderByList: orderByList?.call(AttendanceRecord.t),
      transaction: transaction,
      noReturn: noReturn,
    );
  }

  /// Deletes a single [AttendanceRecord].
  Future<AttendanceRecord> deleteRow(
    _is.DatabaseSession session,
    AttendanceRecord row, {
    _is.Transaction? transaction,
  }) async {
    return session.db.deleteRow<AttendanceRecord>(
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
  Future<List<AttendanceRecord>> deleteWhere(
    _is.DatabaseSession session, {
    required _is.WhereExpressionBuilder<AttendanceRecordTable> where,
    _is.OrderByBuilder<AttendanceRecordTable>? orderBy,
    _is.OrderByListBuilder<AttendanceRecordTable>? orderByList,
    _is.Transaction? transaction,
    bool noReturn = false,
  }) async {
    return session.db.deleteWhere<AttendanceRecord>(
      where: where(AttendanceRecord.t),
      orderBy: orderBy?.call(AttendanceRecord.t),
      orderByList: orderByList?.call(AttendanceRecord.t),
      transaction: transaction,
      noReturn: noReturn,
    );
  }

  /// Counts the number of rows matching the [where] expression. If omitted,
  /// will return the count of all rows in the table.
  Future<int> count(
    _is.DatabaseSession session, {
    _is.WhereExpressionBuilder<AttendanceRecordTable>? where,
    int? limit,
    _is.Transaction? transaction,
  }) async {
    return session.db.count<AttendanceRecord>(
      where: where?.call(AttendanceRecord.t),
      limit: limit,
      transaction: transaction,
    );
  }

  /// Acquires row-level locks on [AttendanceRecord] rows matching the [where] expression.
  Future<void> lockRows(
    _is.DatabaseSession session, {
    required _is.WhereExpressionBuilder<AttendanceRecordTable> where,
    required _is.LockMode lockMode,
    required _is.Transaction transaction,
    _is.LockBehavior lockBehavior = _is.LockBehavior.wait,
  }) async {
    return session.db.lockRows<AttendanceRecord>(
      where: where(AttendanceRecord.t),
      lockMode: lockMode,
      lockBehavior: lockBehavior,
      transaction: transaction,
    );
  }
}
