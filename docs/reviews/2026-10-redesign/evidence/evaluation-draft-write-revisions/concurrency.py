import subprocess,time,json,pathlib
base=['docker','exec','-i','supabase_db_mecg-goal-20261016','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
def sql(query):return subprocess.run(base,input=query,text=True,capture_output=True,check=True).stdout.strip()
fixture=pathlib.Path('supabase/tests/evaluation_draft_write_revisions.sql').read_text().split('select extensions.ok(')[0]
fixture=fixture.replace('select extensions.plan(38);','');sql(fixture+'commit;')
auth='''set local "request.jwt.claims" = '{"iss":"https://draft-cas.example.invalid","sub":"69000000-0000-4000-8000-000000000001","role":"authenticated"}';set local role authenticated;'''
ratings=json.dumps([{'criterionId':'draft-cas-criterion','score':'4','note':'Observed'}]);final=json.dumps([{'criterionId':'draft-cas-criterion','score':4,'note':'Observed'}])
def save(assignment,note,revision,mid):
 token='null' if revision is None else "'"+revision+"'"
 return f"select rush.save_evaluation_draft_v2('{assignment}','{ratings}','{note}',{token},'{mid}');"
def submit(assignment,revision):return f"select rush.submit_evaluation_v2('{assignment}','{final}','Final','{revision}');"
def pair(first_call,second_call,expect_error=False):
 first=subprocess.Popen(base,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 first.stdin.write("set application_name='mecg-draft-first';begin;"+auth+first_call+'select pg_sleep(2);commit;');first.stdin.close()
 for _ in range(100):
  if sql("select count(*) from pg_stat_activity where application_name='mecg-draft-first' and wait_event='PgSleep'")=='1':break
  time.sleep(.02)
 else:raise Exception('first transaction did not reach controlled hold')
 second=subprocess.Popen(base,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 second.stdin.write("set application_name='mecg-draft-second';begin;"+auth+second_call+'commit;');second.stdin.close()
 waiting=False
 for _ in range(60):
  waiting=sql("select count(*) from pg_stat_activity where application_name='mecg-draft-second' and wait_event_type='Lock'")=='1'
  if waiting:break
  time.sleep(.02)
 first.wait(timeout=10);second.wait(timeout=10)
 assert waiting,'second connection not observed waiting on shared assignment lock'
 assert first.returncode==0,first.stderr.read()
 one=json.loads(first.stdout.read().strip().splitlines()[0]);error=second.stderr.read()
 if expect_error:
  assert second.returncode!=0 and 'assignment closed' in error,error
  two={'error':'assignment closed'}
 else:
  assert second.returncode==0,error
  two=json.loads(second.stdout.read().strip().splitlines()[0])
 return {'secondObservedWaitingOnAssignmentLock':True,'first':one,'second':two}
report={}
report['concurrentFirstSaves']=pair(save('draft-cas-assignment','First',None,'40000000-0000-4000-8000-000000000001'),save('draft-cas-assignment','Stale',None,'40000000-0000-4000-8000-000000000002'))
first=report['concurrentFirstSaves'];assert first['first']['kind']=='saved' and first['second']['kind']=='conflict';assert first['second']['snapshot']['revision']==first['first']['revision']
revision=first['first']['revision']
report['saveThenStaleSubmit']=pair(save('draft-cas-assignment','Newer',revision,'40000000-0000-4000-8000-000000000003'),submit('draft-cas-assignment',revision))
assert report['saveThenStaleSubmit']['second']['kind']=='conflict'
initial=json.loads(sql('begin;'+auth+save('draft-cas-assignment2','Pre-submit',None,'40000000-0000-4000-8000-000000000004')+'commit;'))
report['submitThenLateSave']=pair(submit('draft-cas-assignment2',initial['revision']),save('draft-cas-assignment2','Late',initial['revision'],'40000000-0000-4000-8000-000000000005'),True)
assert report['submitThenLateSave']['first']['kind']=='submitted'
assert sql("select count(*) from rush.evaluation_drafts where assignment_id='draft-cas-assignment2'")=='0'
assert sql("select count(*) from rush.evaluations where assignment_id='draft-cas-assignment2'")=='1'
assert sql("select count(*) from rush.evaluations where assignment_id='draft-cas-assignment'")=='0'
report['result']='PASS';report['noDraftResurrection']=True
print(json.dumps(report,indent=2))
