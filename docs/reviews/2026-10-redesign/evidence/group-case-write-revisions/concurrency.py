import subprocess,time,json,pathlib
base=['docker','exec','-i','supabase_db_mecg-goal-20261016','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
def sql(query):
 p=subprocess.run(base,input=query,text=True,capture_output=True,check=True);return p.stdout.strip()
fixture=pathlib.Path('supabase/tests/group_case_write_revisions.sql').read_text().split('set local "request.jwt.claims"')[0]
fixture=fixture.replace('select extensions.plan(30);','')
sql(fixture+'commit;')
auth='''set local "request.jwt.claims" = '{"iss":"https://grading-contracts.example.invalid","sub":"59000000-0000-4000-8000-000000000002","role":"authenticated"}';set local role authenticated;'''
def call(note,mid):return f'''select rush.rate_group_case_applicant_v2('59000000-0000-4000-8000-000000000051','59000000-0000-4000-8000-000000000031','{{"59000000-0000-4000-8000-000000000071":4}}','{note}',null,'{mid}');'''
first=subprocess.Popen(base,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
first.stdin.write("set application_name='mecg-cas-first';begin;"+auth+call('Concurrent first','20000000-0000-4000-8000-000000000001')+'select pg_sleep(3);commit;');first.stdin.close()
for _ in range(100):
 if sql("select count(*) from pg_stat_activity where application_name='mecg-cas-first' and wait_event='PgSleep'")=='1':break
 time.sleep(.03)
else:raise Exception('first transaction did not reach controlled hold')
second=subprocess.Popen(base,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
second.stdin.write("set application_name='mecg-cas-second';begin;"+auth+call('Concurrent second','20000000-0000-4000-8000-000000000002')+'commit;');second.stdin.close()
waiting=False
for _ in range(70):
 waiting=sql("select count(*) from pg_stat_activity where application_name='mecg-cas-second' and wait_event='advisory'")=='1'
 if waiting:break
 time.sleep(.03)
first.wait(timeout=10);second.wait(timeout=10)
one=first.stdout.read().strip();two=second.stdout.read().strip()
assert first.returncode==0,first.stderr.read()
assert second.returncode==0,second.stderr.read()
saved=json.loads(one.splitlines()[0]);conflict=json.loads(two.splitlines()[0])
assert waiting,'second transaction was not observed waiting on advisory lock'
assert saved['kind']=='saved' and conflict['kind']=='conflict'
assert conflict['snapshot']['revision']==saved['revision']
assert conflict['snapshot']['note']=='Concurrent first'
assert sql("select count(*) from rush.audit_events where action='GROUP_CASE_RATED' and resource_id='59000000-0000-4000-8000-000000000031'")=='1'
print(json.dumps({'result':'PASS','twoConnections':True,'secondObservedWaitingOnAdvisoryLock':waiting,'first':saved,'second':conflict,'ratingAuditWrites':1},indent=2))
