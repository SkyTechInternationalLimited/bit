import { expect } from 'chai';
import path from 'path';
import fs from 'fs-extra';
import Helper from '../e2e-helper';
import * as fixtures from '../fixtures/fixtures';

//  track directories functionality = add/rename files to rootDir or trackDir
describe('track directories functionality', function () {
  this.timeout(0);
  const helper = new Helper();
  after(() => {
    helper.destroyEnv();
  });
  describe('add a directory as authored', () => {
    let localScope;
    before(() => {
      helper.reInitLocalScope();
      helper.createFile('utils/bar', 'foo.js');
      helper.addComponent('utils/bar');
      localScope = helper.cloneLocalScope();
    });
    it('should add the directory as trackDir in bitmap file', () => {
      const bitMap = helper.readBitMap();
      expect(bitMap).to.have.property('utils/bar');
      expect(bitMap['utils/bar'].trackDir).to.equal('utils/bar');
    });
    describe('creating another file in the same directory', () => {
      let statusOutput;
      before(() => {
        helper.getClonedLocalScope(localScope);
        helper.createFile('utils/bar', 'foo2.js');
        statusOutput = helper.runCmd('bit status');
      });
      it('bit status should still show the component as new', () => {
        expect(statusOutput).to.have.string('new components');
        expect(statusOutput).to.have.string('no modified components');
        expect(statusOutput).to.not.have.string('no new components');
      });
      it('bit status should update bitmap and add the new file', () => {
        const bitMap = helper.readBitMap();
        expect(bitMap).to.have.property('utils/bar');
        const files = bitMap['utils/bar'].files;
        expect(files).to.deep.include({ relativePath: 'utils/bar/foo.js', test: false, name: 'foo.js' });
        expect(files).to.deep.include({ relativePath: 'utils/bar/foo2.js', test: false, name: 'foo2.js' });
      });
      describe('rename a non-main file', () => {
        before(() => {
          const currentFile = path.join(helper.localScopePath, 'utils/bar/foo2.js');
          const newFile = path.join(helper.localScopePath, 'utils/bar/foo3.js');
          fs.moveSync(currentFile, newFile);
          statusOutput = helper.runCmd('bit status');
        });
        it('should rename the file in bitmap', () => {
          const bitMap = helper.readBitMap();
          expect(bitMap).to.have.property('utils/bar');
          const files = bitMap['utils/bar'].files;
          expect(files).to.deep.include({ relativePath: 'utils/bar/foo.js', test: false, name: 'foo.js' });
          expect(files).to.not.deep.include({ relativePath: 'utils/bar/foo2.js', test: false, name: 'foo2.js' });
          expect(files).to.deep.include({ relativePath: 'utils/bar/foo3.js', test: false, name: 'foo3.js' });
          expect(files).to.have.lengthOf(2);
        });
      });
    });
    describe('rename the file which is a main file', () => {
      let statusOutput;
      before(() => {
        const currentFile = path.join(helper.localScopePath, 'utils/bar/foo.js');
        const newFile = path.join(helper.localScopePath, 'utils/bar/foo2.js');
        fs.moveSync(currentFile, newFile);
        try {
          statusOutput = helper.runCmd('bit status');
        } catch (err) {
          statusOutput = err.message;
        }
      });
      it('bit status should throw an error', () => {
        expect(statusOutput).to.have.string('mainFile utils/bar/foo.js is not in the files list');
      });
      it('should not rename the file in bitmap file', () => {
        const bitMap = helper.readBitMap();
        expect(bitMap).to.have.property('utils/bar');
        expect(bitMap['utils/bar'].files[0].relativePath).to.equal('utils/bar/foo.js');
      });
    });
    describe('tagging the component', () => {
      before(() => {
        helper.getClonedLocalScope(localScope);
        helper.commitAllComponents();
      });
      it('should save the files with relativePaths relative to consumer root', () => {
        const output = helper.catComponent('utils/bar@latest');
        expect(output.files[0].relativePath).to.equal('utils/bar/foo.js');
        expect(output.mainFile).to.equal('utils/bar/foo.js');
      });
      describe('then adding a new file to the directory', () => {
        let statusOutput;
        before(() => {
          helper.createFile('utils/bar', 'foo2.js');
          statusOutput = helper.runCmd('bit status');
        });
        it('bit status should show the component as modified', () => {
          expect(statusOutput).to.have.string('no new components');
          expect(statusOutput).to.not.have.string('no modified components');
          expect(statusOutput).to.have.string('modified components');
        });
        it('bit status should update bitmap and add the new file', () => {
          const bitMap = helper.readBitMap();
          expect(bitMap).to.have.property('utils/bar');
          const files = bitMap['utils/bar'].files;
          expect(files).to.deep.include({ relativePath: 'utils/bar/foo.js', test: false, name: 'foo.js' });
          expect(files).to.deep.include({ relativePath: 'utils/bar/foo2.js', test: false, name: 'foo2.js' });
        });
      });
    });
    describe('adding a file outside of that directory', () => {
      let output;
      before(() => {
        helper.getClonedLocalScope(localScope);
        helper.createFile('utils', 'a.js');
        output = helper.addComponent('utils/a.js --id utils/bar');
      });
      it('should add the file successfully', () => {
        expect(output).to.have.string('added utils/a.js');
      });
      it('should remove the trackDir property from bitmap file', () => {
        const bitMap = helper.readBitMap();
        expect(bitMap).to.have.property('utils/bar');
        expect(bitMap['utils/bar']).to.not.have.property('trackDir');
      });
    });
  });
  describe('add multiple directories', () => {
    before(() => {
      helper.reInitLocalScope();
      helper.createFile('utils/foo', 'index.js');
      helper.createFile('utils/bar', 'index.js');
      helper.createFile('utils/baz', 'index.js');
      helper.addComponent('utils/**');
    });
    it('should add trackDir property for each one of the directories', () => {
      const bitMap = helper.readBitMap();
      expect(bitMap['utils/foo']).to.have.property('trackDir');
      expect(bitMap['utils/foo'].trackDir).to.equal('utils/foo');

      expect(bitMap['utils/bar']).to.have.property('trackDir');
      expect(bitMap['utils/bar'].trackDir).to.equal('utils/bar');

      expect(bitMap['utils/baz']).to.have.property('trackDir');
      expect(bitMap['utils/baz'].trackDir).to.equal('utils/baz');
    });
  });
  describe('add directory with tests', () => {
    before(() => {
      helper.reInitLocalScope();
      helper.createFile('utils/bar', 'foo.js');
      helper.createFile('utils/bar', 'foo.spec.js');
      helper.addComponentWithOptions('utils/bar', { t: 'utils/bar/foo.spec.js' });
      helper.createFile('utils/bar', 'foo2.js');
      helper.runCmd('bit status');
    });
    it('should track the directories without changing the test files', () => {
      const bitMap = helper.readBitMap();
      expect(bitMap['utils/bar']).to.have.property('trackDir');
      expect(bitMap['utils/bar'].files).to.deep.include({
        relativePath: 'utils/bar/foo.spec.js',
        test: true,
        name: 'foo.spec.js'
      });
      expect(bitMap['utils/bar'].files).to.deep.include({
        relativePath: 'utils/bar/foo2.js',
        test: false,
        name: 'foo2.js'
      });
    });
  });
  describe('add a directory with exclude', () => {
    before(() => {
      helper.reInitLocalScope();
      helper.createFile('utils/bar', 'foo.js');
      helper.createFile('utils/bar', 'foo2.js');
      helper.addComponentWithOptions('utils/bar', { e: 'utils/bar/foo2.js', m: 'foo.js' });
      helper.runCmd('bit status');
    });
    it('should not add the trackDir property', () => {
      const bitMap = helper.readBitMap();
      expect(bitMap).to.have.property('utils/bar');
      expect(bitMap['utils/bar']).to.not.have.property('trackDir');
    });
    it('should not add the excluded file', () => {
      const bitMap = helper.readBitMap();
      expect(bitMap['utils/bar'].files[0].relativePath).to.equal('utils/bar/foo.js');
      expect(bitMap['utils/bar'].files).to.have.lengthOf(1);
    });
  });
  describe('import a component with dependencies', () => {
    let barFooId;
    before(() => {
      helper.setNewLocalAndRemoteScopes();
      helper.createFile('utils', 'is-type.js', fixtures.isType);
      helper.addComponent('utils/is-type.js');
      helper.createFile('utils', 'is-string.js', fixtures.isString);
      helper.addComponent('utils/is-string.js');
      helper.createComponentBarFoo(fixtures.barFooFixture);
      helper.addComponentBarFoo();
      helper.commitAllComponents();
      helper.exportAllComponents();
      helper.reInitLocalScope();
      helper.addRemoteScope();
      helper.importComponent('bar/foo');
      barFooId = `${helper.remoteScope}/bar/foo@0.0.1`;
    });
    it('should not add trackDir field', () => {
      const bitMap = helper.readBitMap();
      expect(bitMap).to.have.property(barFooId);
      expect(bitMap[barFooId]).to.not.have.property('trackDir');
    });
    describe('adding a new file to the rootDir', () => {
      let statusOutput;
      let bitMap;
      let files;
      before(() => {
        helper.createFile('components/bar/foo', 'foo2.js');
        statusOutput = helper.runCmd('bit status');
        bitMap = helper.readBitMap();
        files = bitMap[barFooId].files;
      });
      it('bit status should show the component as modified', () => {
        expect(statusOutput).to.have.string('no new components');
        expect(statusOutput).to.not.have.string('no modified components');
        expect(statusOutput).to.have.string('modified components');
        expect(statusOutput).to.have.string('bar/foo');
      });
      it('should track the file in bitMap', () => {
        expect(files).to.deep.include({ relativePath: 'bar/foo.js', test: false, name: 'foo.js' });
        expect(files).to.deep.include({ relativePath: 'foo2.js', test: false, name: 'foo2.js' });
      });
      it('should not track the link files', () => {
        files.forEach((file) => {
          expect(file.name).to.not.equal('is-string.js');
        });
      });
      it('should not track gitignore files', () => {
        files.forEach((file) => {
          expect(file.name).to.not.equal('package.json');
          expect(file.name).to.not.equal('package-lock.json');
        });
      });
      describe('tagging the component', () => {
        before(() => {
          helper.commitAllComponents();
          statusOutput = helper.runCmd('bit status');
        });
        it('bit status should show the component as staged and not as modified', () => {
          expect(statusOutput).to.have.string('no new components');
          expect(statusOutput).to.have.string('no modified components');
          expect(statusOutput).to.have.string('staged components');
          expect(statusOutput).to.not.have.string('no staged components');
        });
        it('should save both files to the model', () => {
          const barFoo = helper.catComponent(`${helper.remoteScope}/bar/foo@latest`);
          expect(barFoo.files[0].name).to.equal('foo.js');
          expect(barFoo.files[1].name).to.equal('foo2.js');
          expect(barFoo.files).to.have.lengthOf(2);
        });
      });
    });
  });
});
